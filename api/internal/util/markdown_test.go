package util

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestMarkdownToTipTap_Table(t *testing.T) {
	markdown := `| Symbol | Date | Close | Change % |
| --- | --- | ---: | ---: |
| AAPL | 2026-10-07 | 335.18 USD | +0.46 |
| MSFT | 2026-10-07 | 527.25 USD | -0.39 |
| NVDA | 2026-10-07 | 238.63 USD | -0.25 |
| MU | 2026-10-07 | 1,033.49 USD | -1.15 |
| SPCX | 2026-10-07 | 168.24 USD | -2.14 |
| GOOG | 2026-10-07 | 343.17 USD | -0.41 |
| AMZN | 2026-10-07 | 255.11 USD | -0.46 |
| 2330.TW | 2026-10-07 | 2,585.00 TWD | +0.00 |`
	out, err := MarkdownToTipTap(markdown)
	if err != nil {
		t.Fatal(err)
	}
	var doc TipTapNode
	if err := json.Unmarshal([]byte(out), &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Content) != 1 || doc.Content[0].Type != "table" {
		t.Fatalf("expected table, got %s", out)
	}
	rows := doc.Content[0].Content
	if len(rows) != 9 {
		t.Fatalf("got %d rows, want 9", len(rows))
	}
	lines := strings.Split(markdown, "\n")
	for i, row := range rows {
		if row.Type != "tableRow" || len(row.Content) != 4 {
			t.Fatalf("invalid row: %+v", row)
		}
		lineIndex := i
		cellType := "tableHeader"
		if i > 0 {
			lineIndex++
			cellType = "tableCell"
		}
		values := strings.Split(strings.Trim(lines[lineIndex], "|"), "|")
		for j, cell := range row.Content {
			if cell.Type != cellType || len(cell.Content) != 1 || cell.Content[0].Type != "paragraph" {
				t.Fatalf("invalid cell: %+v", cell)
			}
			var value string
			for _, node := range cell.Content[0].Content {
				value += node.Text
			}
			if value != strings.TrimSpace(values[j]) {
				t.Fatalf("cell %d,%d: got %q, want %q", i, j, value, strings.TrimSpace(values[j]))
			}
		}
	}
}

func TestMarkdownToTipTap_TableEmptyAndFormattedCells(t *testing.T) {
	out, err := MarkdownToTipTap("Before\n\nName | Value\n--- | ---\n**bold** |\n\nAfter")
	if err != nil {
		t.Fatal(err)
	}
	var doc TipTapNode
	if err := json.Unmarshal([]byte(out), &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Content) != 3 || doc.Content[0].Type != "paragraph" || doc.Content[1].Type != "table" || doc.Content[2].Type != "paragraph" {
		t.Fatalf("expected paragraph/table/paragraph, got %s", out)
	}
	rows := doc.Content[1].Content
	if len(rows) != 2 || len(rows[1].Content) != 2 {
		t.Fatalf("invalid table: %s", out)
	}
	cells := rows[1].Content
	bold := cells[0].Content[0].Content
	if len(bold) != 1 || bold[0].Text != "bold" || len(bold[0].Marks) != 1 || bold[0].Marks[0].Type != "bold" {
		t.Fatalf("lost bold formatting: %s", out)
	}
	if len(cells[1].Content) != 1 || cells[1].Content[0].Type != "paragraph" || len(cells[1].Content[0].Content) != 0 {
		t.Fatalf("invalid empty cell: %s", out)
	}
}

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
