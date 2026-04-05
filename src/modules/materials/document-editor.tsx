'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PiTextB as Bold, PiTextItalic as Italic, PiTextUnderline as UnderlineIcon, PiTextStrikethrough as Strikethrough, PiTextAa as SubscriptIcon, PiTextH as SuperscriptIcon, PiCode as Code, PiCodeSimple as Code2, PiQuotes as Quote, PiMinus as Minus, PiList as List, PiListNumbers as ListOrdered, PiTextHOne as Heading1, PiTextHTwo as Heading2, PiTextHThree as Heading3, PiTextT as Type, PiArrowCounterClockwise as Undo, PiArrowClockwise as Redo, PiHighlighterCircle as Highlighter, PiPalette as Palette, PiEraser as Eraser } from 'react-icons/pi';
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
  const colorLabels = messages.editor.colors;
  const highlightLabels = messages.editor.highlights;
  const resolvedPlaceholder = placeholder ?? messages.studio.editor.placeholders.document;
  const [showColors, setShowColors] = useState<'text' | 'highlight' | null>(null);

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

  if (!editor) return null;

  return (
    <div className={className}>
      {editable && (
        <div
          className="flex flex-wrap items-center gap-1 border-b border-border pb-2 mb-4"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!editor.can().undo()}
            aria-label={toolbar.undo}
            title={toolbar.undo}
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
            title={toolbar.redo}
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
            title={toolbar.bold}
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
            title={toolbar.italic}
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
            title={toolbar.underline}
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
            onClick={setH1}
            data-active={editor.isActive('heading', { level: 1 })}
            aria-label={toolbar.heading1}
            aria-pressed={editor.isActive('heading', { level: 1 })}
            title={toolbar.heading1}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setH2}
            data-active={editor.isActive('heading', { level: 2 })}
            aria-label={toolbar.heading2}
            aria-pressed={editor.isActive('heading', { level: 2 })}
            title={toolbar.heading2}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setH3}
            data-active={editor.isActive('heading', { level: 3 })}
            aria-label={toolbar.heading3}
            aria-pressed={editor.isActive('heading', { level: 3 })}
            title={toolbar.heading3}
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setParagraph}
            data-active={editor.isActive('paragraph')}
            aria-label={toolbar.bodyText}
            aria-pressed={editor.isActive('paragraph')}
            title={toolbar.bodyText}
          >
            <Type className="h-4 w-4" />
          </Button>
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
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
