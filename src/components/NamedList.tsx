import { X } from "lucide-react"
import { useState } from "react"
import { compareNames } from "../lib/text.ts"
import type { Entry, ListItem } from "../lib/types.ts"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntrySelect } from "./EntrySelect.tsx"
import { fieldClass } from "./styles.ts"

export function NamedList({
  title,
  placeholder,
  items,
  entries,
  currentEntryId,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string
  placeholder: string
  items: ListItem[]
  entries: Entry[]
  currentEntryId: string
  onAdd: (label: string) => Promise<void>
  onUpdate: (id: string, patch: { label?: string; linkedEntryId?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ListItem | null>(null)
  const sorted = [...items].sort((a, b) => compareNames(a.label, b.label) || a.createdAt.localeCompare(b.createdAt))
  const linkedIds = new Set(items.flatMap((item) => (item.linkedEntryId ? [item.linkedEntryId] : [])))

  async function add() {
    const label = draft.trim()
    if (!label) return
    setError(null)
    try {
      await onAdd(label)
      setDraft("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that.")
    }
  }

  return (
    <section>
      <h3 className="kicker mb-2">{title}</h3>
      <ul className="flex flex-col gap-2">
        {sorted.map((item) => {
          const value = drafts[item.id] ?? item.label
          const linked = entries.find((entry) => entry.id === item.linkedEntryId)
          return (
            <li key={item.id} className="rounded-lg border border-line bg-black/20 p-2">
              <div className="flex items-center gap-1">
                <input
                  value={value}
                  aria-label={`${title} name`}
                  className={fieldClass}
                  onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  onBlur={() => {
                    const next = value.trim()
                    setDrafts((current) => {
                      const copy = { ...current }
                      delete copy[item.id]
                      return copy
                    })
                    if (next && next !== item.label) void onUpdate(item.id, { label: next })
                  }}
                />
                <button type="button" aria-label={`Remove ${item.label}`} className="text-muted hover:text-cream" onClick={() => setPendingDelete(item)}>
                  <X size={16} />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                {linked ? (
                  <button
                    type="button"
                    className="truncate text-xs text-muted hover:text-cream"
                    onClick={() => void onUpdate(item.id, { linkedEntryId: null })}
                  >
                    {linked.name} · unlink
                  </button>
                ) : (
                  <EntrySelect
                    entries={entries}
                    excludeIds={[currentEntryId, ...linkedIds]}
                    label="Link entry"
                    onSelect={(entryId) => void onUpdate(item.id, { linkedEntryId: entryId })}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={fieldClass}
        />
        <button type="submit" className="shrink-0 text-sm text-muted hover:text-cream" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${pendingDelete.label}?`}
          message={`This removes ${pendingDelete.label} from ${title.toLowerCase()}.`}
          confirmLabel="Remove"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id
            setPendingDelete(null)
            void onDelete(id)
          }}
        />
      )}
    </section>
  )
}
