package util

import (
	"bytes"
	"encoding/json"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

// TipTapNode represents a node in the TipTap JSON structure
type TipTapNode struct {
	Type    string                 `json:"type"`
	Content []TipTapNode           `json:"content,omitempty"`
	Marks   []TipTapMark           `json:"marks,omitempty"`
	Text    string                 `json:"text,omitempty"`
	Attrs   map[string]interface{} `json:"attrs,omitempty"`
}

// TipTapMark represents a mark (formatting) in TipTap
type TipTapMark struct {
	Type  string                 `json:"type"`
	Attrs map[string]interface{} `json:"attrs,omitempty"`
}

// MarkdownToTipTap converts markdown text to TipTap JSON format
func MarkdownToTipTap(markdown string) (string, error) {
	// Parse markdown using goldmark
	md := goldmark.New()
	reader := text.NewReader([]byte(markdown))
	doc := md.Parser().Parse(reader)

	// Convert AST to TipTap JSON
	tiptapDoc := TipTapNode{
		Type:    "doc",
		Content: []TipTapNode{},
	}

	// Process all children of the document
	for child := doc.FirstChild(); child != nil; child = child.NextSibling() {
		if node := convertNode(child, []byte(markdown)); node != nil {
			tiptapDoc.Content = append(tiptapDoc.Content, *node)
		}
	}

	// If there's no content, add an empty paragraph
	if len(tiptapDoc.Content) == 0 {
		tiptapDoc.Content = append(tiptapDoc.Content, TipTapNode{
			Type: "paragraph",
		})
	}

	// Convert to JSON
	jsonBytes, err := json.Marshal(tiptapDoc)
	if err != nil {
		return "", err
	}

	return string(jsonBytes), nil
}

// convertNode converts a goldmark AST node to a TipTap node
func convertNode(n ast.Node, source []byte) *TipTapNode {
	switch n.Kind() {
	case ast.KindParagraph:
		return convertParagraph(n, source)
	case ast.KindHeading:
		return convertHeading(n, source)
	case ast.KindBlockquote:
		return convertBlockquote(n, source)
	case ast.KindCodeBlock:
		return convertCodeBlock(n, source)
	case ast.KindFencedCodeBlock:
		return convertFencedCodeBlock(n, source)
	case ast.KindList:
		return convertList(n, source)
	case ast.KindListItem:
		return convertListItem(n, source)
	case ast.KindThematicBreak:
		return &TipTapNode{Type: "horizontalRule"}
	case ast.KindHTMLBlock:
		// Skip HTML blocks
		return nil
	default:
		// For other block-level nodes, try to process children
		return convertParagraph(n, source)
	}
}

func convertParagraph(n ast.Node, source []byte) *TipTapNode {
	node := &TipTapNode{
		Type:    "paragraph",
		Content: []TipTapNode{},
	}

	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		node.Content = append(node.Content, convertInlineNode(child, source)...)
	}

	return node
}

func convertHeading(n ast.Node, source []byte) *TipTapNode {
	heading := n.(*ast.Heading)
	node := &TipTapNode{
		Type: "heading",
		Attrs: map[string]interface{}{
			"level": heading.Level,
		},
		Content: []TipTapNode{},
	}

	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		node.Content = append(node.Content, convertInlineNode(child, source)...)
	}

	return node
}

func convertBlockquote(n ast.Node, source []byte) *TipTapNode {
	node := &TipTapNode{
		Type:    "blockquote",
		Content: []TipTapNode{},
	}

	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		if childNode := convertNode(child, source); childNode != nil {
			node.Content = append(node.Content, *childNode)
		}
	}

	return node
}

func convertCodeBlock(n ast.Node, source []byte) *TipTapNode {
	var buf bytes.Buffer
	lines := n.Lines()
	for i := 0; i < lines.Len(); i++ {
		line := lines.At(i)
		buf.Write(line.Value(source))
	}

	return &TipTapNode{
		Type: "codeBlock",
		Content: []TipTapNode{
			{
				Type: "text",
				Text: strings.TrimSuffix(buf.String(), "\n"),
			},
		},
	}
}

func convertFencedCodeBlock(n ast.Node, source []byte) *TipTapNode {
	fenced := n.(*ast.FencedCodeBlock)
	var buf bytes.Buffer
	lines := n.Lines()
	for i := 0; i < lines.Len(); i++ {
		line := lines.At(i)
		buf.Write(line.Value(source))
	}

	node := &TipTapNode{
		Type: "codeBlock",
		Content: []TipTapNode{
			{
				Type: "text",
				Text: strings.TrimSuffix(buf.String(), "\n"),
			},
		},
	}

	// Add language attribute if specified
	if fenced.Language(source) != nil {
		if node.Attrs == nil {
			node.Attrs = make(map[string]interface{})
		}
		node.Attrs["language"] = string(fenced.Language(source))
	}

	return node
}

func convertList(n ast.Node, source []byte) *TipTapNode {
	list := n.(*ast.List)
	var listType string
	if list.IsOrdered() {
		listType = "orderedList"
	} else {
		listType = "bulletList"
	}

	node := &TipTapNode{
		Type:    listType,
		Content: []TipTapNode{},
	}

	// Add order attribute for ordered lists
	if list.IsOrdered() && list.Start != 1 {
		if node.Attrs == nil {
			node.Attrs = make(map[string]interface{})
		}
		node.Attrs["start"] = list.Start
	}

	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		if childNode := convertNode(child, source); childNode != nil {
			node.Content = append(node.Content, *childNode)
		}
	}

	return node
}

func convertListItem(n ast.Node, source []byte) *TipTapNode {
	node := &TipTapNode{
		Type:    "listItem",
		Content: []TipTapNode{},
	}

	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		if childNode := convertNode(child, source); childNode != nil {
			node.Content = append(node.Content, *childNode)
		}
	}

	// If list item has no block content, wrap inline content in a paragraph
	if len(node.Content) == 0 {
		node.Content = append(node.Content, TipTapNode{
			Type: "paragraph",
		})
	}

	return node
}

// convertInlineNode converts one inline AST node to zero or more TipTap
// nodes. It returns a slice (rather than a single node) because emphasis/
// strong spans can contain multiple child nodes - e.g. a literal delimiter
// character goldmark couldn't pair (as in "workflow_dispatch" inside
// "_..._"), or a nested mark like a link inside italic text - and every
// child has to make it into the output, not just the first one.
func convertInlineNode(n ast.Node, source []byte) []TipTapNode {
	switch n.Kind() {
	case ast.KindText:
		if node := convertText(n, source, nil); node != nil {
			return []TipTapNode{*node}
		}
		return nil
	case ast.KindEmphasis:
		emphasis := n.(*ast.Emphasis)
		mark := TipTapMark{Type: "italic"}
		if emphasis.Level == 2 {
			mark = TipTapMark{Type: "bold"}
		}
		return convertMarkedChildren(n, source, mark)
	case ast.KindCodeSpan:
		if node := convertCodeSpan(n, source); node != nil {
			return []TipTapNode{*node}
		}
		return nil
	case ast.KindLink:
		if node := convertLink(n, source); node != nil {
			return []TipTapNode{*node}
		}
		return nil
	case ast.KindImage:
		if node := convertImage(n, source); node != nil {
			return []TipTapNode{*node}
		}
		return nil
	case ast.KindAutoLink:
		if node := convertAutoLink(n, source); node != nil {
			return []TipTapNode{*node}
		}
		return nil
	default:
		// For unknown inline nodes, try to extract text
		if textNode, ok := n.(*ast.Text); ok {
			return []TipTapNode{{
				Type: "text",
				Text: string(textNode.Segment.Value(source)),
			}}
		}
		return nil
	}
}

// convertMarkedChildren converts every child of an emphasis/strong node and
// prepends mark to each resulting node, so nested spans (e.g. a link or a
// nested emphasis for bold+italic) keep their own marks in addition to it.
func convertMarkedChildren(n ast.Node, source []byte, mark TipTapMark) []TipTapNode {
	var out []TipTapNode
	for child := n.FirstChild(); child != nil; child = child.NextSibling() {
		for _, node := range convertInlineNode(child, source) {
			node.Marks = append([]TipTapMark{mark}, node.Marks...)
			out = append(out, node)
		}
	}
	return out
}

func convertText(n ast.Node, source []byte, marks []TipTapMark) *TipTapNode {
	textNode := n.(*ast.Text)
	text := string(textNode.Segment.Value(source))

	// Handle soft line breaks
	if textNode.SoftLineBreak() {
		text += "\n"
	}

	// Handle hard line breaks
	if textNode.HardLineBreak() {
		return &TipTapNode{
			Type: "hardBreak",
		}
	}

	node := &TipTapNode{
		Type: "text",
		Text: text,
	}

	if len(marks) > 0 {
		node.Marks = marks
	}

	return node
}

func convertCodeSpan(n ast.Node, source []byte) *TipTapNode {
	codeSpan := n.(*ast.CodeSpan)
	var buf bytes.Buffer
	for i := 0; i < codeSpan.ChildCount(); i++ {
		child := codeSpan.FirstChild()
		for j := 0; j < i; j++ {
			child = child.NextSibling()
		}
		if text, ok := child.(*ast.Text); ok {
			buf.Write(text.Segment.Value(source))
		}
	}

	return &TipTapNode{
		Type: "text",
		Text: buf.String(),
		Marks: []TipTapMark{
			{Type: "code"},
		},
	}
}

func convertLink(n ast.Node, source []byte) *TipTapNode {
	link := n.(*ast.Link)
	marks := []TipTapMark{
		{
			Type: "link",
			Attrs: map[string]interface{}{
				"href":   string(link.Destination),
				"target": "_blank",
			},
		},
	}

	// Get link text
	var text string
	for child := link.FirstChild(); child != nil; child = child.NextSibling() {
		if textNode, ok := child.(*ast.Text); ok {
			text += string(textNode.Segment.Value(source))
		}
	}

	return &TipTapNode{
		Type:  "text",
		Text:  text,
		Marks: marks,
	}
}

func convertImage(n ast.Node, source []byte) *TipTapNode {
	image := n.(*ast.Image)

	// Get alt text
	var alt string
	for child := image.FirstChild(); child != nil; child = child.NextSibling() {
		if textNode, ok := child.(*ast.Text); ok {
			alt += string(textNode.Segment.Value(source))
		}
	}

	return &TipTapNode{
		Type: "image",
		Attrs: map[string]interface{}{
			"src": string(image.Destination),
			"alt": alt,
		},
	}
}

func convertAutoLink(n ast.Node, source []byte) *TipTapNode {
	autoLink := n.(*ast.AutoLink)
	url := string(autoLink.URL(source))

	return &TipTapNode{
		Type: "text",
		Text: url,
		Marks: []TipTapMark{
			{
				Type: "link",
				Attrs: map[string]interface{}{
					"href":   url,
					"target": "_blank",
				},
			},
		},
	}
}
