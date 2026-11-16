import { GripHorizontal, StickyNote, X } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import { cx } from "../lib/cx.ts"
import { orderByIds } from "../lib/pc.ts"
import { compareNames, messageOf } from "../lib/text.ts"
import type { Entry, StickyNote as StickyNoteRecord } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { fieldClass, iconButtonClass, primaryClass } from "./styles.ts"

export function StickyBoard() {
  const { campaign, stickyNotes, entriesLoadedFor, createStickyNote, updateStickyNote } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; to: number; y: number } | null>(null)
  const ready = entriesLoadedFor === campaign?.id
  const notes = arrangeNotes(
    stickyNotes.filter((note) => note.campaignId === campaign?.id),
    campaign?.id,
  )
  const shown = drag ? moveNote(notes, drag.id, drag.to) : notes
  const draggingId = drag?.id ?? null

  useEffect(() => {
    if (!draggingId) return
    let frame = 0
    const tick = () => {
      const current = dragRef.current
      if (!current) return
      const scroller = scrollParent(listRef.current)
      if (scroller) {
        const rect = scroller.getBoundingClientRect()
        if (current.y < rect.top + 36) scroller.scrollTop -= 10
        else if (current.y > rect.bottom - 36) scroller.scrollTop += 10
      }
      const to = indexAt(listRef.current, current.y, current.to)
      if (to !== current.to) {
        current.to = to
        setDrag({ id: current.id, to })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [draggingId])

  function commit(next: StickyNoteRecord[]) {
    if (campaign?.id) writeNoteOrder(campaign.id, next.map((note) => note.id))
    next.forEach((note, index) => {
      if (note.sortIndex !== index) void updateStickyNote(note.id, { sortIndex: index })
    })
  }

  function finishDrag() {
    const current = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!current) return
    const next = moveNote(notes, current.id, current.to)
    if (next.every((note, index) => note.id === notes[index]?.id)) return
    commit(next)
  }

  function onGripDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return
    const from = notes.findIndex((note) => note.id === id)
    if (from < 0) return
    dragRef.current = { id, to: from, y: event.clientY }
    setDrag({ id, to: from })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onGripMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = dragRef.current
    if (!current) return
    current.y = event.clientY
    const to = indexAt(listRef.current, event.clientY, current.to)
    if (to === current.to) return
    current.to = to
    setDrag({ id: current.id, to })
  }

  function onGripKey(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    event.preventDefault()
    const from = notes.findIndex((note) => note.id === id)
    const to = event.key === "ArrowUp" ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= notes.length) return
    commit(moveNote(notes, id, to))
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className={`${primaryClass} self-start`}
        disabled={!ready}
        onClick={() => {
          setError(null)
          void createStickyNote()
            .then((note) => setFocusId(note.id))
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        Add note
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!ready ? (
        <p className="text-sm text-faint">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted">Nothing stuck here yet. A note can sit with the campaign, or with one character.</p>
      ) : (
        <div ref={listRef} className="flex flex-col gap-3">
          {shown.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              autoFocus={note.id === focusId}
              dragging={drag?.id === note.id}
              onGripDown={onGripDown}
              onGripMove={onGripMove}
              onGripUp={finishDrag}
              onGripKey={onGripKey}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function StickyNotesDock() {
  const { setNotesOpen } = useApp()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target
      if (target instanceof HTMLElement && (target.closest("[role='dialog']") || target.closest("[data-escape-lock]"))) return
      event.stopPropagation()
      setNotesOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [setNotesOpen])

  return (
    <aside
      aria-label="Sticky notes"
      className="fixed right-4 bottom-4 z-40 flex max-h-[min(40rem,calc(100dvh-5.5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_24px_60px_rgb(0_0_0/0.45)]"
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <StickyNote size={16} />
        <h2 className="min-w-0 flex-1 font-serif text-lg">Sticky notes</h2>
        <button type="button" className={iconButtonClass} aria-label="Close sticky notes" onClick={() => setNotesOpen(false)}>
          <X size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <StickyBoard />
      </div>
    </aside>
  )
}

function NoteCard({
  note,
  autoFocus,
  dragging,
  onGripDown,
  onGripMove,
  onGripUp,
  onGripKey,
}: {
  note: StickyNoteRecord
  autoFocus: boolean
  dragging: boolean
  onGripDown: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void
  onGripMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onGripUp: () => void
  onGripKey: (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => void
}) {
  const { entries, campaign, updateStickyNote, deleteStickyNote } = useApp()
  const [body, setBody] = useState(note.body)
  const [confirming, setConfirming] = useState(false)
  const queue = useAutosave(400)
  const characters = entries
    .filter((entry) => entry.campaignId === campaign?.id && (entry.section === "pcs" || entry.section === "npcs"))
    .sort((a, b) => compareNames(a.name, b.name))
  const pcs = characters.filter((entry) => entry.section === "pcs")
  const npcs = characters.filter((entry) => entry.section === "npcs")
  const assigned = characters.some((entry) => entry.id === note.characterId) ? (note.characterId ?? "") : ""

  return (
    <article
      data-note=""
      className={cx("rounded-lg border border-line bg-[#3a3228] p-3 shadow-md", dragging && "opacity-60")}
      style={{ boxShadow: "inset 0 3px 0 var(--campaign)" }}
    >
      <button
        type="button"
        aria-label="Reorder note"
        className="mb-1 flex h-6 w-full cursor-grab items-center justify-center rounded-md text-faint hover:bg-white/5 hover:text-cream active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => onGripDown(event, note.id)}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onKeyDown={(event) => onGripKey(event, note.id)}
      >
        <GripHorizontal size={14} />
      </button>
      <textarea
        autoFocus={autoFocus}
        value={body}
        aria-label="Sticky note"
        data-escape-lock=""
        placeholder="Write it down before it slips."
        rows={4}
        className="w-full resize-y bg-transparent text-sm text-cream outline-none placeholder:text-faint"
        onChange={(event) => {
          const next = event.target.value
          setBody(next)
          queue(() => {
            void updateStickyNote(note.id, { body: next })
          })
        }}
      />
      <label className="mt-2 block">
        <span className="kicker">Character</span>
        <select
          aria-label="Assign to character"
          value={assigned}
          className={`${fieldClass} mt-2`}
          onChange={(event) => {
            void updateStickyNote(note.id, { characterId: event.target.value || null })
          }}
        >
          <option value="">Unassigned</option>
          {pcs.length > 0 && <CharacterOptions label="PCs" entries={pcs} />}
          {npcs.length > 0 && <CharacterOptions label="NPCs" entries={npcs} />}
        </select>
      </label>
      <button type="button" className="mt-2 text-xs text-faint hover:text-danger" onClick={() => setConfirming(true)}>
        Delete note
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete this note?"
          message="The note is removed. The character stays."
          confirmLabel="Delete note"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void deleteStickyNote(note.id)
          }}
        />
      )}
    </article>
  )
}

function CharacterOptions({ label, entries }: { label: string; entries: Entry[] }) {
  return (
    <optgroup label={label}>
      {entries.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.name}
        </option>
      ))}
    </optgroup>
  )
}

const NOTE_ORDER_KEY = "dm-table:note-order"

function arrangeNotes(notes: StickyNoteRecord[], campaignId: string | undefined) {
  const ranked = [...notes].sort((a, b) => a.sortIndex - b.sortIndex || b.createdAt.localeCompare(a.createdAt))
  if (!campaignId || ranked.some((note) => note.sortIndex !== 0)) return ranked
  const saved = readNoteOrder(campaignId)
  if (!saved?.length) return ranked
  const known = new Set(ranked.map((note) => note.id))
  const fresh = ranked.filter((note) => !saved.includes(note.id)).map((note) => note.id)
  const placed = saved.filter((id) => known.has(id))
  return orderByIds(ranked, [...fresh, ...placed])
}

function readNoteOrder(campaignId: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTE_ORDER_KEY) ?? "{}") as Record<string, unknown>
    const ids = parsed[campaignId]
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : null
  } catch {
    return null
  }
}

function writeNoteOrder(campaignId: string, ids: string[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTE_ORDER_KEY) ?? "{}") as Record<string, unknown>
    localStorage.setItem(NOTE_ORDER_KEY, JSON.stringify({ ...parsed, [campaignId]: ids }))
  } catch {
    // The order still stays in this session when storage is unavailable.
  }
}

function moveNote(notes: StickyNoteRecord[], id: string, to: number) {
  const from = notes.findIndex((note) => note.id === id)
  if (from < 0 || from === to) return notes
  const next = [...notes]
  const [note] = next.splice(from, 1)
  if (!note) return notes
  next.splice(to, 0, note)
  return next
}

function indexAt(list: HTMLElement | null, clientY: number, fallback: number) {
  const cards = list?.querySelectorAll<HTMLElement>("[data-note]")
  if (!cards?.length) return fallback
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return i
  }
  return cards.length - 1
}

function scrollParent(node: HTMLElement | null) {
  let current = node?.parentElement ?? null
  while (current) {
    const style = getComputedStyle(current)
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1) return current
    current = current.parentElement
  }
  return null
}
