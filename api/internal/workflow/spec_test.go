package workflow

import (
	"testing"

	"github.com/notomate/notomate/internal/model"
)

const fullExample = `
name: Notify on note changes
on:
  note:
    types: [created, updated]
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:
    inputs:
      message:
        description: Message to send
        required: false
        default: "hello"
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`

func TestParseAndValidateFullExample(t *testing.T) {
	spec, errs := ParseAndValidate(fullExample)
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %v", errs)
	}

	if spec.Name != "Notify on note changes" {
		t.Fatalf("unexpected name: %q", spec.Name)
	}
	if spec.On.Note == nil || len(spec.On.Note.Types) != 2 {
		t.Fatalf("note trigger not parsed: %+v", spec.On.Note)
	}
	if !spec.MatchesNoteEvent(model.WorkflowEventNoteCreated) || !spec.MatchesNoteEvent(model.WorkflowEventNoteUpdated) {
		t.Fatal("expected created/updated to match")
	}
	if spec.MatchesNoteEvent(model.WorkflowEventNoteDeleted) {
		t.Fatal("deleted should not match")
	}
	if !spec.HasSchedule() || spec.On.Schedule[0].Cron != "0 9 * * 1" {
		t.Fatalf("schedule not parsed: %+v", spec.On.Schedule)
	}
	if !spec.HasWorkflowDispatch() {
		t.Fatal("workflow_dispatch not parsed")
	}
	if def, ok := spec.On.WorkflowDispatch.Inputs["message"]; !ok || def.Default != "hello" {
		t.Fatalf("inputs not parsed: %+v", spec.On.WorkflowDispatch.Inputs)
	}
	job, ok := spec.Jobs["notify"]
	if !ok || len(job.RunsOn) != 1 || job.RunsOn[0] != "ubuntu-latest" {
		t.Fatalf("jobs not parsed: %+v", spec.Jobs)
	}
}

func TestParseTriggerShortForms(t *testing.T) {
	// Scalar form.
	spec, errs := ParseAndValidate("on: note\njobs:\n  a:\n    runs-on: ubuntu-latest\n")
	if len(errs) != 0 {
		t.Fatalf("scalar form errors: %v", errs)
	}
	if spec.On.Note == nil || len(spec.On.Note.Types) != 3 {
		t.Fatalf("scalar note trigger should default to all types: %+v", spec.On.Note)
	}

	// List form.
	spec, errs = ParseAndValidate("on: [note, workflow_dispatch]\njobs:\n  a:\n    runs-on: [ubuntu-latest, docker]\n")
	if len(errs) != 0 {
		t.Fatalf("list form errors: %v", errs)
	}
	if spec.On.Note == nil || spec.On.WorkflowDispatch == nil {
		t.Fatalf("list form triggers not parsed: %+v", spec.On)
	}
	if len(spec.Jobs["a"].RunsOn) != 2 {
		t.Fatalf("runs-on list not parsed: %+v", spec.Jobs["a"])
	}
}

func TestParseAndValidateErrors(t *testing.T) {
	cases := []struct {
		name string
		yaml string
	}{
		{"not yaml", ":::"},
		{"no triggers", "name: x\njobs:\n  a:\n    runs-on: ubuntu-latest\n"},
		{"unknown trigger", "on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n"},
		{"bad note type", "on:\n  note:\n    types: [edited]\njobs:\n  a:\n    runs-on: ubuntu-latest\n"},
		{"bad cron", "on:\n  schedule:\n    - cron: \"99 99 * * *\"\njobs:\n  a:\n    runs-on: ubuntu-latest\n"},
		{"schedule not list", "on:\n  schedule: daily\njobs:\n  a:\n    runs-on: ubuntu-latest\n"},
		{"no jobs", "on: workflow_dispatch\n"},
		{"job without runs-on", "on: workflow_dispatch\njobs:\n  a:\n    steps: []\n"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, errs := ParseAndValidate(tc.yaml); len(errs) == 0 {
				t.Fatalf("expected validation errors for %q", tc.name)
			}
		})
	}
}
