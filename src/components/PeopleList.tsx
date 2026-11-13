import { GripVertical, X } from "lucide-react"
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { cx } from "../lib/cx.ts"
import { orderByIds } from "../lib/pc.ts"
import type { PcPerson } from "../lib/types.ts"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { fieldClass } from "./styles.ts"

export function PeopleList({
  people,
  onAdd,
  onRename,
  onReorder,
  onDelete,
}: {
  people: PcPerson[]
  onAdd: (label: string) => void
  onRename: (id: string, label: string) => void
  onReorder: (ids: string[]) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<PcPerson | null>(null)
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const dragRef = useRef<{ from: number; startY: number; height: number } | null>(null)
  const shown = drag
    ? orderByIds(people, movedIds(people.map((person) => person.id), drag.from, drag.to))
    : people

  function finishDrag(clientY: number) {
    const current = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!current) return
    const to = clamp(current.from + Math.round((clientY - current.startY) / current.height), 0, people.length - 1)
    if (to !== current.from) onReorder(movedIds(people.map((person) => person.id), current.from, to))
  }

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (event.button !== 0) return
    const row = event.currentTarget.closest("li")
    dragRef.current = {
      from: index,
      startY: event.clientY,
      height: row?.getBoundingClientRect().height ?? 44,
    }
    setDrag({ from: index, to: index })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  return (
    <div>
      <form
        className="mb-2"
        onSubmit={(event) => {
          event.preventDefault()
          const label = draft.trim()
          if (!label) return
          setDraft("")
          onAdd(label)
        }}
      >
        <input
          value={draft}
          aria-label="New alliance or person"
          placeholder="Type a name and press Enter"
          className={fieldClass}
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
      {people.length === 0 ? (
        <p className="text-sm text-faint">No one listed yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((person) => {
            const index = people.findIndex((item) => item.id === person.id)
            const value = drafts[person.id] ?? person.label
            const dragging = drag?.from === index
            return (
              <li key={person.id} className={cx("flex items-center gap-1", dragging && "opacity-60")}>
                <button
                  type="button"
                  aria-label={`Reorder ${person.label}`}
                  className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-faint hover:text-cream active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                  onPointerDown={(event) => onGripDown(event, index)}
                  onPointerMove={(event) => {
                    const current = dragRef.current
                    if (!current) return
                    const to = clamp(
                      current.from + Math.round((event.clientY - current.startY) / current.height),
                      0,
                      people.length - 1,
                    )
                    setDrag((previous) => (previous && previous.to === to ? previous : { from: current.from, to }))
                  }}
                  onPointerUp={(event) => finishDrag(event.clientY)}
                  onPointerCancel={(event) => finishDrag(event.clientY)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
                    event.preventDefault()
                    const to = event.key === "ArrowUp" ? index - 1 : index + 1
                    if (to < 0 || to >= people.length) return
                    onReorder(movedIds(people.map((item) => item.id), index, to))
                  }}
                >
                  <GripVertical size={16} />
                </button>
                <input
                  value={value}
                  aria-label={`${person.label} name`}
                  className={`${fieldClass} min-w-0`}
                  onChange={(event) => setDrafts((current) => ({ ...current, [person.id]: event.target.value }))}
                  onBlur={() => {
                    const next = value.trim()
                    setDrafts((current) => {
                      const copy = { ...current }
                      delete copy[person.id]
                      return copy
                    })
                    if (next && next !== person.label) onRename(person.id, next)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    event.preventDefault()
                    event.currentTarget.blur()
                  }}
                />
                <button
                  type="button"
                  aria-label={`Remove ${person.label}`}
                  className="inline-flex size-8 shrink-0 items-center justify-center text-muted hover:text-cream"
                  onClick={() => setPending(person)}
                >
                  <X size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {pending && (
        <ConfirmDialog
          title={`Remove ${pending.label}?`}
          message={`This removes ${pending.label} from alliances.`}
          confirmLabel="Remove"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const id = pending.id
            setPending(null)
            onDelete(id)
          }}
        />
      )}
    </div>
  )
}

function movedIds(ids: string[], from: number, to: number) {
  const next = [...ids]
  const [id] = next.splice(from, 1)
  if (!id) return ids
  next.splice(to, 0, id)
  return next
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
