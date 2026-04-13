'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, isNodeEmpty } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { PiTextB as Bold, PiTextItalic as Italic, PiTextUnderline as UnderlineIcon, PiTextStrikethrough as Strikethrough, PiTextSubscript as SubscriptIcon, PiTextSuperscript as SuperscriptIcon, PiCode as Code, PiCodeBlock as Code2, PiQuotes as Quote, PiMinus as Minus, PiListBullets as List, PiListNumbers as ListOrdered, PiArrowCounterClockwise as Undo, PiArrowClockwise as Redo, PiHighlighter as Highlighter, PiPalette as Palette, PiEraser as Eraser } from 'react-icons/pi';
import { useI18n } from '@/src/i18n/i18n-provider';

const TEXT_COLORS = [
  { key: 'default', value: '' },
  { key: 'gray', value: '#6b7280' },
  { key: 'red', value: '#dc2626' },
  { key: 'orange', value: '#ea580c' },
  { key: 'amber', value: '#d97706' },
  { key: 'green', value: '#16a34a' },
  { key: 'blue', value: '#2563eb' },
  { key: 'purple', value: '#7c3aed' },
] as const;

const HIGHLIGHT_COLORS = [
  { key: 'none', value: '' },
  { key: 'yellow', value: '#fef08a' },
  { key: 'green', value: '#bbf7d0' },
  { key: 'blue', value: '#bfdbfe' },
  { key: 'pink', value: '#fbcfe8' },
] as const;

function getParentNodeInfo(state: any, nodeTypeName: string): { depth: number; node: any } | null {
  const { $from } = state.selection;
  const nodeType = state.schema?.nodes?.[nodeTypeName];
  if (!nodeType) return null;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === nodeType) {
      return { depth, node };
    }
  }
  return null;
}

const BreakListItemOnEmpty = Extension.create({
  name: 'breakListItemOnEmpty',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const listInfo = getParentNodeInfo(state, 'listItem');
        if (listInfo) {
          const isEmpty = isNodeEmpty(listInfo.node, {
            ignoreWhitespace: true,
            checkChildren: true,
          });

          if (isEmpty) {
            return this.editor.commands.liftListItem('listItem');
          }
        }

        const quoteInfo = getParentNodeInfo(state, 'blockquote');
        if (quoteInfo) {
          const isEmpty = isNodeEmpty(quoteInfo.node, {
            ignoreWhitespace: true,
            checkChildren: true,
          });
          if (isEmpty) {
            return this.editor.commands.lift('blockquote');
          }
        }

        return false;
      },
      Backspace: () => {
        const { state } = this.editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const atStartOfTextblock = $from.parentOffset === 0;

        const listInfo = getParentNodeInfo(state, 'listItem');
        if (listInfo) {
          const isFirstChild = $from.index(listInfo.depth) === 0;
          if (atStartOfTextblock && isFirstChild) {
            return this.editor.commands.liftListItem('listItem');
          }
        }

        if (!atStartOfTextblock) return false;

        if (this.editor.isActive('blockquote')) {
          return this.editor.commands.lift('blockquote');
        }

        if (this.editor.isActive('codeBlock')) {
          return this.editor.commands.setParagraph();
        }

        return false;
      },
    };
  },
});

interface DocumentEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function DocumentEditor({
  content,
  onChange,
  placeholder,
  editable = true,
  className = '',
}: DocumentEditorProps) {
  const { messages } = useI18n();
  const toolbar = messages.editor.toolbar;
  const statusCopy = messages.editor.status;
  const colorLabels = messages.editor.colors;
  const highlightLabels = messages.editor.highlights;
  const resolvedPlaceholder = placeholder ?? messages.studio.editor.placeholders.document;
  const [showColors, setShowColors] = useState<'text' | 'highlight' | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [, setToolbarTick] = useState(0);
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  }, []);
  const modifierKey = isMac ? 'Cmd' : 'Ctrl';
  const redoShortcut = isMac ? `${modifierKey}+Shift+Z` : `${modifierKey}+Y`;
  const withShortcut = useCallback(
    (label: string, shortcut: string) => `${label} (${shortcut})`,
    []
  );

  useEffect(() => {
    if (!showColors) return;
    const close = () => setShowColors(null);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [showColors]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      BreakListItemOnEmpty,
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      SubscriptExtension,
      SuperscriptExtension,
    ],
    content: content || '<p></p>',
    editable,
    editorProps: {
      clipboardTextSerializer: (slice) => {
        const text = slice.content.textBetween(0, slice.content.size, '\n');
        return text.replace(/\n+$/g, '');
      },
      attributes: {
        class: 'document-editor-content focus:outline-none min-h-[calc(100vh-16rem)] px-1',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>');
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => onChange(editor.getHTML());
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, onChange]);

  const updateCounts = useCallback(() => {
    const text = editor?.getText() ?? '';
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(text.length);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    updateCounts();
    editor.on('update', updateCounts);
    return () => {
      editor.off('update', updateCounts);
    };
  }, [editor, updateCounts]);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setToolbarTick((x) => x + 1);
    editor.on('selectionUpdate', bump);
    editor.on('transaction', bump);
    return () => {
      editor.off('selectionUpdate', bump);
      editor.off('transaction', bump);
    };
  }, [editor]);

  const setBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const setItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const setUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor]);
  const setStrike = useCallback(() => editor?.chain().focus().toggleStrike().run(), [editor]);
  const setSubscript = useCallback(() => editor?.chain().focus().toggleSubscript().run(), [editor]);
  const setSuperscript = useCallback(() => editor?.chain().focus().toggleSuperscript().run(), [editor]);
  const setInlineCode = useCallback(() => editor?.chain().focus().toggleCode().run(), [editor]);
  const setCodeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor]);
  const setBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const insertHorizontalRule = useCallback(() => editor?.chain().focus().setHorizontalRule().run(), [editor]);
  const setBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const setOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const setH1 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const setH2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const setH3 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);
  const setParagraph = useCallback(() => editor?.chain().focus().setParagraph().run(), [editor]);
  const clearFormatting = useCallback(() => {
    editor?.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);
  const setColor = useCallback((color: string) => {
    if (color) editor?.chain().focus().setColor(color).run();
    else editor?.chain().focus().unsetColor().run();
    setShowColors(null);
  }, [editor]);
  const setHighlight = useCallback((color: string) => {
    if (color) editor?.chain().focus().setHighlight({ color }).run();
    else editor?.chain().focus().unsetHighlight().run();
    setShowColors(null);
  }, [editor]);
  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

  const setStyle = useCallback(
    (value: string) => {
      switch (value) {
        case 'heading1':
          setH1();
          break;
        case 'heading2':
          setH2();
          break;
        case 'heading3':
          setH3();
          break;
        default:
          setParagraph();
      }
    },
    [setH1, setH2, setH3, setParagraph]
  );

  if (!editor) return null;

  const styleValue =
    editor.isActive('heading', { level: 1 })
      ? 'heading1'
      : editor.isActive('heading', { level: 2 })
        ? 'heading2'
        : editor.isActive('heading', { level: 3 })
          ? 'heading3'
          : 'paragraph';

  return (
    <div className={`pb-8 ${className}`}>
      {editable && (
        <div className="sticky top-0 z-20 -mx-2 mb-3 border-b border-border/60 bg-background px-2 py-2">
          <div
            className="flex flex-wrap items-center gap-1"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="min-w-[150px]" onMouseDown={(e) => e.stopPropagation()}>
              <Select
                value={styleValue}
                onChange={(e) => setStyle(e.target.value)}
                aria-label={toolbar.bodyText}
                className="h-8 text-xs"
              >
                <SelectItem value="paragraph">{toolbar.bodyText}</SelectItem>
                <SelectItem value="heading1">{toolbar.heading1}</SelectItem>
                <SelectItem value="heading2">{toolbar.heading2}</SelectItem>
                <SelectItem value="heading3">{toolbar.heading3}</SelectItem>
              </Select>
            </div>
            <span className="w-px h-5 bg-border mx-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={undo}
              disabled={!editor.can().undo()}
              aria-label={toolbar.undo}
              title={withShortcut(toolbar.undo, `${modifierKey}Z`)}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={redo}
              disabled={!editor.can().redo()}
              aria-label={toolbar.redo}
              title={withShortcut(toolbar.redo, redoShortcut)}
            >
              <Redo className="h-4 w-4" />
            </Button>
            <span className="w-px h-5 bg-border mx-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={setBold}
              data-active={editor.isActive('bold')}
              aria-label={toolbar.bold}
              aria-pressed={editor.isActive('bold')}
              title={withShortcut(toolbar.bold, `${modifierKey}B`)}
            >
              <Bold className="h-4 w-4" />
            </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setItalic}
            data-active={editor.isActive('italic')}
            aria-label={toolbar.italic}
            aria-pressed={editor.isActive('italic')}
            title={withShortcut(toolbar.italic, `${modifierKey}I`)}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setUnderline}
            data-active={editor.isActive('underline')}
            aria-label={toolbar.underline}
            aria-pressed={editor.isActive('underline')}
            title={withShortcut(toolbar.underline, `${modifierKey}U`)}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setStrike}
            data-active={editor.isActive('strike')}
            aria-label={toolbar.strikethrough}
            aria-pressed={editor.isActive('strike')}
            title={toolbar.strikethrough}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setSubscript}
            data-active={editor.isActive('subscript')}
            aria-label={toolbar.subscript}
            aria-pressed={editor.isActive('subscript')}
            title={toolbar.subscript}
          >
            <SubscriptIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setSuperscript}
            data-active={editor.isActive('superscript')}
            aria-label={toolbar.superscript}
            aria-pressed={editor.isActive('superscript')}
            title={toolbar.superscript}
          >
            <SuperscriptIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setInlineCode}
            data-active={editor.isActive('code')}
            aria-label={toolbar.inlineCode}
            aria-pressed={editor.isActive('code')}
            title={toolbar.inlineCode}
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearFormatting}
            aria-label={toolbar.clearFormatting}
            title={toolbar.clearFormatting}
          >
            <Eraser className="h-4 w-4" />
          </Button>
            <span className="w-px h-5 bg-border mx-1" />
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-10 flex flex-col gap-0.5"
                onClick={(e) => { e.stopPropagation(); setShowColors((s) => (s === 'text' ? null : 'text')); }}
                aria-label={toolbar.textColor}
                aria-haspopup="menu"
                aria-expanded={showColors === 'text'}
                title={toolbar.textColor}
              >
                <Palette className="h-4 w-4" />
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }} />
              </Button>
              {showColors === 'text' && (
                <div className="absolute left-0 top-full mt-1.5 p-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="grid grid-cols-4 gap-1.5 min-w-[120px]">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className="h-7 w-7 rounded-sm border border-border transition-transform hover:scale-110 active:scale-95 flex items-center justify-center p-0.5"
                        style={c.value ? { backgroundColor: c.value } : undefined}
                        onClick={() => setColor(c.value)}
                        title={colorLabels[c.key]}
                      >
                        {!c.value && <Eraser className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-10 flex flex-col gap-0.5"
                onClick={(e) => { e.stopPropagation(); setShowColors((s) => (s === 'highlight' ? null : 'highlight')); }}
                title={toolbar.highlight}
                data-active={editor.isActive('highlight')}
                aria-label={toolbar.highlight}
                aria-pressed={editor.isActive('highlight')}
                aria-haspopup="menu"
                aria-expanded={showColors === 'highlight'}
              >
                <Highlighter className="h-4 w-4" />
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: editor.getAttributes('highlight').color || 'transparent', border: !editor.getAttributes('highlight').color ? '1px solid currentColor' : 'none' }} />
              </Button>
              {showColors === 'highlight' && (
                <div className="absolute left-0 top-full mt-1.5 p-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="grid grid-cols-5 gap-1.5 min-w-[150px]">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className="h-7 w-7 rounded-sm border border-border transition-transform hover:scale-110 active:scale-95 flex items-center justify-center p-0.5"
                        style={c.value ? { backgroundColor: c.value } : undefined}
                        onClick={() => setHighlight(c.value)}
                        title={highlightLabels[c.key]}
                      >
                        {!c.value && <Eraser className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          <span className="w-px h-5 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setBulletList}
            data-active={editor.isActive('bulletList')}
            aria-label={toolbar.bulletList}
            aria-pressed={editor.isActive('bulletList')}
            title={toolbar.bulletList}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setOrderedList}
            data-active={editor.isActive('orderedList')}
            aria-label={toolbar.numberedList}
            aria-pressed={editor.isActive('orderedList')}
            title={toolbar.numberedList}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <span className="w-px h-5 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setBlockquote}
            data-active={editor.isActive('blockquote')}
            aria-label={toolbar.quote}
            aria-pressed={editor.isActive('blockquote')}
            title={toolbar.quote}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setCodeBlock}
            data-active={editor.isActive('codeBlock')}
            aria-label={toolbar.codeBlock}
            aria-pressed={editor.isActive('codeBlock')}
            title={toolbar.codeBlock}
          >
            <Code2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={insertHorizontalRule}
            aria-label={toolbar.divider}
            title={toolbar.divider}
          >
            <Minus className="h-4 w-4" />
          </Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{statusCopy.words}: {wordCount}</span>
        <span>{statusCopy.characters}: {charCount}</span>
      </div>
    </div>
  );
}
