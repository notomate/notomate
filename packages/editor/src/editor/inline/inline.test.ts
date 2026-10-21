import { describe, expect, it } from 'vitest';
import { deleteTextRange, splitHtmlAt } from './splitHtml';
import { htmlToText, sanitizeInline } from './sanitize';
import { matchShortcut } from '../markdownShortcuts';
import { fragmentFromText } from '../clipboard';
import { setBlocks } from '../blocks/registry';
import { allBlocks } from '../blocks/builtins';

setBlocks(allBlocks);

describe('splitHtmlAt', () => {
  it('splits plain text', () => {
    expect(splitHtmlAt('hello world', 5)).toEqual(['hello', ' world']);
  });

  it('keeps formatting on both halves', () => {
    expect(splitHtmlAt('a<b>bold</b>c', 3)).toEqual(['a<b>bo</b>', '<b>ld</b>c']);
  });

  it('drops the selected range and empty wrappers', () => {
    expect(splitHtmlAt('ab<i>cd</i>ef', 2, 4)).toEqual(['ab', 'ef']);
    expect(splitHtmlAt('abc', 0)).toEqual(['', 'abc']);
    expect(splitHtmlAt('abc', 3)).toEqual(['abc', '']);
  });

  it('deletes a text range', () => {
    expect(deleteTextRange('/head<b>ing</b>', 0, 5)).toBe('<b>ing</b>');
  });
});

describe('sanitizeInline', () => {
  it('keeps whitelisted marks and strips the rest', () => {
    expect(sanitizeInline('<strong>a</strong><em>b</em><script>x</script><span style="color:red">c</span>')).toBe(
      '<b>a</b><i>b</i>c',
    );
  });

  it('only keeps safe links', () => {
    expect(sanitizeInline('<a href="https://x.dev">x</a>')).toBe('<a href="https://x.dev">x</a>');
    expect(sanitizeInline('<a href="javascript:alert(1)">x</a>')).toBe('x');
  });

  it('converts html to text with line breaks', () => {
    expect(htmlToText('a<br>b&amp;c')).toBe('a\nb&c');
  });
});

describe('markdown shortcuts', () => {
  it('matches prefixes typed at the start of a block', () => {
    expect(matchShortcut('# ', 2)?.type).toBe('h1');
    expect(matchShortcut('## ', 3)?.type).toBe('h2');
    expect(matchShortcut('- ', 2)?.type).toBe('bullet');
    expect(matchShortcut('1. ', 3)?.type).toBe('numbered');
    expect(matchShortcut('[] ', 3)?.type).toBe('todo');
    expect(matchShortcut('> ', 2)?.type).toBe('toggle');
    expect(matchShortcut('---', 3)?.type).toBe('divider');
    expect(matchShortcut('hello # ', 8)).toBeNull();
  });
});

describe('fragmentFromText', () => {
  it('builds nested blocks from indented markdown', () => {
    const f = fragmentFromText('# Title\n- one\n  - nested\n- [x] done\n```\ncode\n```');
    const types = f.rootIds.map((id) => f.blocks[id].type);
    expect(types).toEqual(['h1', 'bullet', 'todo', 'code']);
    const one = f.blocks[f.rootIds[1]];
    expect(one.children).toHaveLength(1);
    expect(f.blocks[one.children[0]].html).toBe('nested');
    expect(f.blocks[f.rootIds[2]].props.checked).toBe(true);
  });
});
