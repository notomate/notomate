package util

import (
	"encoding/json"
	"testing"
)

// countTextRunes sums the length of every "text" node's Text field found
// anywhere in the TipTap doc, so tests can assert against content length
// instead of exact JSON (mark ordering/splitting is an implementation
// detail of the goldmark AST, not something callers should depend on).
func countTextRunes(t *testing.T, tiptapJSON string) int {
	t.Helper()
	var doc TipTapNode
	if err := json.Unmarshal([]byte(tiptapJSON), &doc); err != nil {
		t.Fatalf("invalid TipTap JSON: %v", err)
	}
	var walk func(n TipTapNode) int
	walk = func(n TipTapNode) int {
		total := len([]rune(n.Text))
		for _, c := range n.Content {
			total += walk(c)
		}
		return total
	}
	return walk(doc)
}

func TestMarkdownToTipTap_EmphasisWithLiteralUnderscore(t *testing.T) {
	// "workflow_dispatch" has an intraword underscore, which CommonMark
	// does not treat as an emphasis delimiter - goldmark splits the
	// surrounding "_..._" span into multiple text nodes as a result. The
	// converter used to only keep the first of those, silently dropping
	// the rest of the sentence.
	md := "_Created manually via workflow_dispatch at 2026-07-11T00:00:00Z_"
	out, err := MarkdownToTipTap(md)
	if err != nil {
		t.Fatal(err)
	}

	want := len([]rune("Created manually via workflow_dispatch at 2026-07-11T00:00:00Z"))
	if got := countTextRunes(t, out); got != want {
		t.Fatalf("content truncated: got %d runes of text, want %d\noutput: %s", got, want, out)
	}
}

func TestMarkdownToTipTap_NestedBoldItalic(t *testing.T) {
	md := "**bold _and italic_ inside**"
	out, err := MarkdownToTipTap(md)
	if err != nil {
		t.Fatal(err)
	}

	want := len([]rune("bold and italic inside"))
	if got := countTextRunes(t, out); got != want {
		t.Fatalf("content truncated: got %d runes of text, want %d\noutput: %s", got, want, out)
	}
}

func TestMarkdownToTipTap_LinkInsideEmphasis(t *testing.T) {
	md := "*italic with [a link](https://x.com) inside*"
	out, err := MarkdownToTipTap(md)
	if err != nil {
		t.Fatal(err)
	}

	var doc TipTapNode
	if err := json.Unmarshal([]byte(out), &doc); err != nil {
		t.Fatalf("invalid TipTap JSON: %v", err)
	}

	var found bool
	var walk func(n TipTapNode)
	walk = func(n TipTapNode) {
		if n.Text == "a link" {
			found = true
			hasItalic, hasLink := false, false
			for _, m := range n.Marks {
				if m.Type == "italic" {
					hasItalic = true
				}
				if m.Type == "link" {
					hasLink = true
				}
			}
			if !hasItalic || !hasLink {
				t.Fatalf("link text missing marks: %+v", n.Marks)
			}
		}
		for _, c := range n.Content {
			walk(c)
		}
	}
	walk(doc)
	if !found {
		t.Fatalf("link text node not found in output: %s", out)
	}
}
