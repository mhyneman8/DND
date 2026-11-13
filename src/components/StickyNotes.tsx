import { StickyNote, X } from "lucide-react"
import { useEffect, useState } from "react"
import { compareNames, messageOf } from "../lib/text.ts"
import type { Entry, StickyNote as StickyNoteRecord } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { fieldClass, iconButtonClass, primaryClass } from "./styles.ts"

export function StickyBoard() {
  const { campaign, stickyNotes, entriesLoadedFor, createStickyNote } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const ready = entriesLoadedFor === campaign?.id
  const notes = stickyNotes
    .filter((note) => note.campaignId === campaign?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

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
        notes.map((note) => <NoteCard key={note.id} note={note} autoFocus={note.id === focusId} />)
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

function NoteCard({ note, autoFocus }: { note: StickyNoteRecord; autoFocus: boolean }) {
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
    <article className="rounded-lg border border-line bg-[#3a3228] p-3 shadow-md" style={{ boxShadow: "inset 0 3px 0 var(--campaign)" }}>
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
