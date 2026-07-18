package workflow

import (
	"fmt"
	"strings"

	"github.com/robfig/cron/v3"
	"gopkg.in/yaml.v3"

	"github.com/notomate/notomate/internal/model"
)

// Spec is the server-side view of a workflow definition. Only the trigger
// surface ("on:") and a shallow shape of "jobs:" are parsed here; the full
// document is parsed by the act library on the runner.
type Spec struct {
	Name        string
	On          Triggers
	Jobs        map[string]JobSpec
	Concurrency *ConcurrencySpec
}

// ConcurrencySpec mirrors GitHub Actions' workflow-level `concurrency:` key.
// Runs sharing the same Group are serialized against each other; when
// CancelInProgress is set, a new run cancels whatever queued/running run
// currently holds the group instead of waiting behind it.
type ConcurrencySpec struct {
	Group            string
	CancelInProgress bool
}

type Triggers struct {
	Note             *NoteTrigger
	Schedule         []ScheduleTrigger
	WorkflowDispatch *WorkflowDispatchTrigger
}

type NoteTrigger struct {
	Types []string
}

type ScheduleTrigger struct {
	Cron string
}

type WorkflowDispatchTrigger struct {
	Inputs map[string]InputDef
}

type InputDef struct {
	Description string `yaml:"description"`
	Required    bool   `yaml:"required"`
	Default     string `yaml:"default"`
}

type JobSpec struct {
	RunsOn []string
}

type ValidationError struct {
	Line    int    `json:"line"`
	Message string `json:"message"`
}

func (e ValidationError) Error() string {
	if e.Line > 0 {
		return fmt.Sprintf("line %d: %s", e.Line, e.Message)
	}
	return e.Message
}

var validNoteEventTypes = map[string]string{
	"created": model.WorkflowEventNoteCreated,
	"updated": model.WorkflowEventNoteUpdated,
	"deleted": model.WorkflowEventNoteDeleted,
}

// MatchesNoteEvent reports whether the spec's note trigger covers the given
// full event name (e.g. "note.updated").
func (s Spec) MatchesNoteEvent(event string) bool {
	if s.On.Note == nil {
		return false
	}
	for _, t := range s.On.Note.Types {
		if validNoteEventTypes[t] == event {
			return true
		}
	}
	return false
}

func (s Spec) HasSchedule() bool {
	return len(s.On.Schedule) > 0
}

func (s Spec) HasWorkflowDispatch() bool {
	return s.On.WorkflowDispatch != nil
}

// ParseAndValidate parses a workflow YAML definition and returns the spec
// together with any validation errors. The spec is only usable when the
// error slice is empty.
func ParseAndValidate(definition string) (Spec, []ValidationError) {
	var spec Spec
	var errs []ValidationError

	var root yaml.Node
	if err := yaml.Unmarshal([]byte(definition), &root); err != nil {
		return spec, []ValidationError{{Message: fmt.Sprintf("invalid YAML: %v", err)}}
	}
	if root.Kind != yaml.DocumentNode || len(root.Content) == 0 || root.Content[0].Kind != yaml.MappingNode {
		return spec, []ValidationError{{Message: "workflow must be a YAML mapping"}}
	}

	doc := root.Content[0]
	var onNode, jobsNode, concurrencyNode *yaml.Node

	for i := 0; i+1 < len(doc.Content); i += 2 {
		key := doc.Content[i]
		value := doc.Content[i+1]
		switch key.Value {
		case "name":
			spec.Name = value.Value
		// YAML 1.1 resolves an unquoted "on" key to a boolean, so the key
		// may surface as "true" instead of "on" depending on quoting.
		case "on", "true":
			onNode = value
		case "jobs":
			jobsNode = value
		case "concurrency":
			concurrencyNode = value
		}
	}

	if concurrencyNode != nil {
		concurrency, concurrencyErrs := parseConcurrency(concurrencyNode)
		errs = append(errs, concurrencyErrs...)
		if len(concurrencyErrs) == 0 {
			spec.Concurrency = concurrency
		}
	}

	if onNode == nil {
		errs = append(errs, ValidationError{Line: doc.Line, Message: "workflow must declare at least one trigger under 'on:'"})
	} else {
		errs = append(errs, parseTriggers(onNode, &spec.On)...)
		if spec.On.Note == nil && len(spec.On.Schedule) == 0 && spec.On.WorkflowDispatch == nil && len(errs) == 0 {
			errs = append(errs, ValidationError{Line: onNode.Line, Message: "no supported trigger found; supported triggers are 'note', 'schedule' and 'workflow_dispatch'"})
		}
	}

	if jobsNode == nil || jobsNode.Kind != yaml.MappingNode || len(jobsNode.Content) == 0 {
		errs = append(errs, ValidationError{Line: doc.Line, Message: "workflow must define at least one job under 'jobs:'"})
	} else {
		spec.Jobs = map[string]JobSpec{}
		for i := 0; i+1 < len(jobsNode.Content); i += 2 {
			nameNode := jobsNode.Content[i]
			jobNode := jobsNode.Content[i+1]
			job, jobErrs := parseJob(nameNode.Value, jobNode)
			errs = append(errs, jobErrs...)
			spec.Jobs[nameNode.Value] = job
		}
	}

	return spec, errs
}

func parseTriggers(onNode *yaml.Node, out *Triggers) []ValidationError {
	var errs []ValidationError

	switch onNode.Kind {
	case yaml.ScalarNode:
		// on: note
		errs = append(errs, parseTriggerName(onNode, nil, out)...)
	case yaml.SequenceNode:
		// on: [note, workflow_dispatch]
		for _, item := range onNode.Content {
			errs = append(errs, parseTriggerName(item, nil, out)...)
		}
	case yaml.MappingNode:
		for i := 0; i+1 < len(onNode.Content); i += 2 {
			errs = append(errs, parseTriggerName(onNode.Content[i], onNode.Content[i+1], out)...)
		}
	default:
		errs = append(errs, ValidationError{Line: onNode.Line, Message: "'on:' must be a string, list or mapping"})
	}

	return errs
}

func parseTriggerName(key *yaml.Node, value *yaml.Node, out *Triggers) []ValidationError {
	switch key.Value {
	case "note":
		return parseNoteTrigger(key, value, out)
	case "schedule":
		return parseScheduleTrigger(key, value, out)
	case "workflow_dispatch":
		return parseWorkflowDispatchTrigger(key, value, out)
	default:
		return []ValidationError{{Line: key.Line, Message: fmt.Sprintf("unsupported trigger %q; supported triggers are 'note', 'schedule' and 'workflow_dispatch'", key.Value)}}
	}
}

func parseNoteTrigger(key *yaml.Node, value *yaml.Node, out *Triggers) []ValidationError {
	trigger := &NoteTrigger{}

	if value != nil && value.Kind == yaml.MappingNode {
		var raw struct {
			Types []string `yaml:"types"`
		}
		if err := value.Decode(&raw); err != nil {
			return []ValidationError{{Line: value.Line, Message: fmt.Sprintf("invalid 'note' trigger: %v", err)}}
		}
		trigger.Types = raw.Types
	}

	// Without an explicit types filter the trigger matches every note event.
	if len(trigger.Types) == 0 {
		trigger.Types = []string{"created", "updated", "deleted"}
	}

	var errs []ValidationError
	for _, t := range trigger.Types {
		if _, ok := validNoteEventTypes[t]; !ok {
			errs = append(errs, ValidationError{Line: key.Line, Message: fmt.Sprintf("invalid note event type %q; valid types are 'created', 'updated' and 'deleted'", t)})
		}
	}
	if len(errs) > 0 {
		return errs
	}

	out.Note = trigger
	return nil
}

func parseScheduleTrigger(key *yaml.Node, value *yaml.Node, out *Triggers) []ValidationError {
	if value == nil || value.Kind != yaml.SequenceNode {
		return []ValidationError{{Line: key.Line, Message: "'schedule' must be a list of entries with a 'cron' expression"}}
	}

	var errs []ValidationError
	var entries []ScheduleTrigger

	for _, item := range value.Content {
		var raw struct {
			Cron string `yaml:"cron"`
		}
		if err := item.Decode(&raw); err != nil || raw.Cron == "" {
			errs = append(errs, ValidationError{Line: item.Line, Message: "schedule entry must have a 'cron' expression"})
			continue
		}
		if _, err := cron.ParseStandard(raw.Cron); err != nil {
			errs = append(errs, ValidationError{Line: item.Line, Message: fmt.Sprintf("invalid cron expression %q: %v", raw.Cron, err)})
			continue
		}
		entries = append(entries, ScheduleTrigger{Cron: raw.Cron})
	}

	if len(errs) > 0 {
		return errs
	}
	out.Schedule = entries
	return nil
}

func parseWorkflowDispatchTrigger(_ *yaml.Node, value *yaml.Node, out *Triggers) []ValidationError {
	trigger := &WorkflowDispatchTrigger{}

	if value != nil && value.Kind == yaml.MappingNode {
		var raw struct {
			Inputs map[string]InputDef `yaml:"inputs"`
		}
		if err := value.Decode(&raw); err != nil {
			return []ValidationError{{Line: value.Line, Message: fmt.Sprintf("invalid 'workflow_dispatch' trigger: %v", err)}}
		}
		trigger.Inputs = raw.Inputs
	}

	out.WorkflowDispatch = trigger
	return nil
}

// parseConcurrency accepts either the GitHub Actions shorthand
// (`concurrency: group-name`, cancel-in-progress defaults to false) or the
// full mapping form (`concurrency: { group: ..., cancel-in-progress: ... }`).
func parseConcurrency(node *yaml.Node) (*ConcurrencySpec, []ValidationError) {
	switch node.Kind {
	case yaml.ScalarNode:
		if node.Value == "" {
			return nil, []ValidationError{{Line: node.Line, Message: "'concurrency' group must not be empty"}}
		}
		return &ConcurrencySpec{Group: node.Value}, nil
	case yaml.MappingNode:
		var raw struct {
			Group            string `yaml:"group"`
			CancelInProgress bool   `yaml:"cancel-in-progress"`
		}
		if err := node.Decode(&raw); err != nil {
			return nil, []ValidationError{{Line: node.Line, Message: fmt.Sprintf("invalid 'concurrency': %v", err)}}
		}
		if raw.Group == "" {
			return nil, []ValidationError{{Line: node.Line, Message: "'concurrency.group' is required"}}
		}
		return &ConcurrencySpec{Group: raw.Group, CancelInProgress: raw.CancelInProgress}, nil
	default:
		return nil, []ValidationError{{Line: node.Line, Message: "'concurrency' must be a string or a mapping with 'group'"}}
	}
}

func parseJob(name string, jobNode *yaml.Node) (JobSpec, []ValidationError) {
	var job JobSpec

	if jobNode.Kind != yaml.MappingNode {
		return job, []ValidationError{{Line: jobNode.Line, Message: fmt.Sprintf("job %q must be a mapping", name)}}
	}

	var runsOnNode *yaml.Node
	for i := 0; i+1 < len(jobNode.Content); i += 2 {
		if jobNode.Content[i].Value == "runs-on" {
			runsOnNode = jobNode.Content[i+1]
		}
	}

	if runsOnNode == nil {
		return job, []ValidationError{{Line: jobNode.Line, Message: fmt.Sprintf("job %q must declare 'runs-on'", name)}}
	}

	switch runsOnNode.Kind {
	case yaml.ScalarNode:
		job.RunsOn = []string{runsOnNode.Value}
	case yaml.SequenceNode:
		for _, item := range runsOnNode.Content {
			job.RunsOn = append(job.RunsOn, item.Value)
		}
	default:
		return job, []ValidationError{{Line: runsOnNode.Line, Message: fmt.Sprintf("job %q has an invalid 'runs-on'; it must be a string or list", name)}}
	}

	if len(job.RunsOn) == 0 || strings.TrimSpace(job.RunsOn[0]) == "" {
		return job, []ValidationError{{Line: runsOnNode.Line, Message: fmt.Sprintf("job %q must declare a non-empty 'runs-on'", name)}}
	}

	return job, nil
}
