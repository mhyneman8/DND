import Highlight from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Highlighter } from "lucide-react"
import { useRef, useState, type CSSProperties } from "react"
import { HIGHLIGHT_COLORS } from "../lib/colors.ts"
import { cx } from "../lib/cx.ts"
import type { RichDoc } from "../lib/types.ts"
import { useDismiss } from "../lib/useDismiss.ts"

export function RichTextField({
  initialContent,
  placeholder = "Notes",
  ariaLabel = "Notes",
  minHeight = 140,
  onChange,
}: {
  initialContent: RichDoc
  placeholder?: string
  ariaLabel?: string
  minHeight?: number
  onChange: (doc: RichDoc) => void
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { ref: paletteRef } = useDismiss(paletteOpen, () => setPaletteOpen(false))

  const editor = useEditor(
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          heading: false,
          code: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
          strike: false,
          link: false,
        }),
        Highlight.configure({ multicolor: true }),
        Placeholder.configure({ placeholder }),
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: "rich-text",
          "aria-label": ariaLabel,
        },
      },
      onUpdate: ({ editor: current }) => {
        onChangeRef.current(current.getJSON())
      },
    },
    [],
  )

  if (!editor) return null

  const activeColor = editor.getAttributes("highlight").color as string | undefined

  function applyHighlight(color: string) {
    if (editor.isActive("highlight", { color })) editor.chain().focus().unsetHighlight().run()
    else editor.chain().focus().toggleHighlight({ color }).run()
    setPaletteOpen(false)
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-line bg-black/25"
      style={{ "--editor-min": `${minHeight}px` } as CSSProperties}
    >
      <div className="flex items-center gap-1 border-b border-line px-1.5 py-1">
        <MarkButton
          label="Bold"
          pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="font-semibold"
        >
          B
        </MarkButton>
        <MarkButton
          label="Italic"
          pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="italic"
        >
          I
        </MarkButton>
        <MarkButton
          label="Underline"
          pressed={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className="underline"
        >
          U
        </MarkButton>
        <div className="relative" ref={paletteRef}>
          <button
            type="button"
            aria-label="Highlight"
            aria-expanded={paletteOpen}
            aria-pressed={editor.isActive("highlight")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPaletteOpen((open) => !open)}
            className={cx(
              "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-cream",
              editor.isActive("highlight") && "bg-white/10 text-cream",
            )}
          >
            <Highlighter size={16} strokeWidth={1.75} style={{ color: activeColor }} />
          </button>
          {paletteOpen && (
            <div className="absolute left-0 z-40 mt-1 flex gap-1 rounded-lg border border-line bg-raised p-2 shadow-[0_16px_40px_rgb(0_0_0/0.35)]">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  aria-label={color.label}
                  aria-pressed={activeColor === color.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyHighlight(color.value)}
                  className={cx(
                    "size-6 rounded-full",
                    activeColor === color.value && "ring-2 ring-cream ring-offset-2 ring-offset-raised",
                  )}
                  style={{ background: color.value }}
                />
              ))}
              <button
                type="button"
                className="px-2 text-xs text-muted hover:text-cream"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run()
                  setPaletteOpen(false)
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function MarkButton({
  label,
  pressed,
  onClick,
  className,
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  className?: string
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cx(
        "inline-flex size-8 items-center justify-center rounded-md font-serif text-sm text-muted hover:bg-white/5 hover:text-cream",
        pressed && "bg-white/10 text-cream",
        className,
      )}
    >
      {children}
    </button>
  )
}
