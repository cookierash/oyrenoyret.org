'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Undo,
  Redo,
  Highlighter,
  Palette,
} from 'lucide-react';

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
];

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
  placeholder = 'Start writing...',
  editable = true,
  className = '',
}: DocumentEditorProps) {
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
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
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
  const setBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const setOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const setH1 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const setH2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const setH3 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);
  const setParagraph = useCallback(() => editor?.chain().focus().setParagraph().run(), [editor]);
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
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2 mb-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!editor.can().undo()}
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
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <span className="w-px h-5 bg-border mx-1" />
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); setShowColors((s) => (s === 'text' ? null : 'text')); }}
              title="Text color"
            >
              <Palette className="h-4 w-4" />
            </Button>
            {showColors === 'text' && (
              <div className="absolute left-0 top-full mt-1 p-2 rounded-md border border-border bg-background z-50 grid grid-cols-4 gap-1">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value || 'default'}
                    type="button"
                    className="h-6 w-6 rounded border border-border"
                    style={c.value ? { backgroundColor: c.value } : undefined}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); setShowColors((s) => (s === 'highlight' ? null : 'highlight')); }}
              title="Highlight"
              data-active={editor.isActive('highlight')}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
            {showColors === 'highlight' && (
              <div className="absolute left-0 top-full mt-1 p-2 rounded-md border border-border bg-background z-50 grid grid-cols-5 gap-1">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value || 'none'}
                    type="button"
                    className="h-6 w-6 rounded border border-border"
                    style={c.value ? { backgroundColor: c.value } : undefined}
                    onClick={() => setHighlight(c.value)}
                    title={c.name}
                  />
                ))}
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
            title="Body text"
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
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={setOrderedList}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
