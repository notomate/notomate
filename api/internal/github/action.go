package github

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

// ActionMetadata is the part of an action.yml the marketplace shows.
type ActionMetadata struct {
	Name        string
	Description string
	Author      string
	Icon        string
	Color       string
	RunsUsing   string
	Inputs      []ActionInput
	Outputs     []ActionOutput
}

type ActionInput struct {
	Name               string
	Description        string
	Required           bool
	Default            string
	DeprecationMessage string
}

type ActionOutput struct {
	Name        string
	Description string
}

type rawActionInput struct {
	Description        string    `yaml:"description"`
	Required           yaml.Node `yaml:"required"`
	Default            yaml.Node `yaml:"default"`
	DeprecationMessage string    `yaml:"deprecationMessage"`
}

type rawAction struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Author      string `yaml:"author"`
	Branding    struct {
		Icon  string `yaml:"icon"`
		Color string `yaml:"color"`
	} `yaml:"branding"`
	Runs struct {
		Using string `yaml:"using"`
	} `yaml:"runs"`
	Inputs  yaml.Node `yaml:"inputs"`
	Outputs yaml.Node `yaml:"outputs"`
}

// ParseActionYAML parses action.yml metadata. Inputs and outputs keep the
// order they are declared in.
func ParseActionYAML(data []byte) (ActionMetadata, error) {
	var raw rawAction
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return ActionMetadata{}, err
	}
	if raw.Runs.Using == "" {
		return ActionMetadata{}, fmt.Errorf("missing 'runs.using'")
	}

	meta := ActionMetadata{
		Name:        raw.Name,
		Description: raw.Description,
		Author:      raw.Author,
		Icon:        raw.Branding.Icon,
		Color:       raw.Branding.Color,
		RunsUsing:   raw.Runs.Using,
	}

	if raw.Inputs.Kind == yaml.MappingNode {
		for i := 0; i+1 < len(raw.Inputs.Content); i += 2 {
			var in rawActionInput
			if err := raw.Inputs.Content[i+1].Decode(&in); err != nil {
				return ActionMetadata{}, fmt.Errorf("input %q: %w", raw.Inputs.Content[i].Value, err)
			}
			meta.Inputs = append(meta.Inputs, ActionInput{
				Name:               raw.Inputs.Content[i].Value,
				Description:        in.Description,
				Required:           in.Required.Kind == yaml.ScalarNode && in.Required.Value == "true",
				Default:            scalarValue(in.Default),
				DeprecationMessage: in.DeprecationMessage,
			})
		}
	}

	if raw.Outputs.Kind == yaml.MappingNode {
		for i := 0; i+1 < len(raw.Outputs.Content); i += 2 {
			var out struct {
				Description string `yaml:"description"`
			}
			_ = raw.Outputs.Content[i+1].Decode(&out)
			meta.Outputs = append(meta.Outputs, ActionOutput{Name: raw.Outputs.Content[i].Value, Description: out.Description})
		}
	}

	return meta, nil
}

// scalarValue returns a default as written; non-scalar defaults are dropped.
func scalarValue(n yaml.Node) string {
	if n.Kind != yaml.ScalarNode || n.Tag == "!!null" {
		return ""
	}
	return n.Value
}
