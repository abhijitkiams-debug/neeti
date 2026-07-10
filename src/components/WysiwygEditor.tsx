"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect } from "react";

export function WysiwygEditor({
  content,
  onChange,
  editable = true,
}: {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "prose prose-slate max-w-none min-h-[300px] focus:outline-none px-4 py-3" },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm font-medium ${active ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <div className="rounded-md border border-slate-300 bg-white">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
          <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            H3
          </button>
          <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
            Bold
          </button>
          <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
            Italic
          </button>
          <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            • List
          </button>
          <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            1. List
          </button>
          <button
            type="button"
            className={btn(false)}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            Table
          </button>
          <button
            type="button"
            className={btn(false)}
            onClick={() => {
              const url = window.prompt("Image URL");
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
          >
            Image
          </button>
          <button
            type="button"
            className={btn(editor.isActive("link"))}
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
          >
            Link
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
