import { X } from "lucide-react"
import { useState } from "react"
import { sectionById } from "../lib/sections.ts"
import { compareNames } from "../lib/text.ts"
import type { Entry, EntryLink } from "../lib/types.ts"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntrySelect } from "./EntrySelect.tsx"

export function EntryLinks({
  entryId,
  entries,
  links,
  onAdd,
  onRemove,
}: {
  entryId: string
  entries: Entry[]
  links: EntryLink[]
  onAdd: (targetId: string) => Promise<void>
  onRemove: (linkId: string) => Promise<void>
}) {
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null)
  const related = links
    .filter((link) => link.sourceEntryId === entryId || link.targetEntryId === entryId)
    .map((link) => {
      const otherId = link.sourceEntryId === entryId ? link.targetEntryId : link.sourceEntryId
      return { link, other: entries.find((entry) => entry.id === otherId) ?? null }
    })
    .sort((a, b) => compareNames(a.other?.name ?? "", b.other?.name ?? ""))

  const excludeIds = [entryId, ...related.map((item) => item.link.sourceEntryId === entryId ? item.link.targetEntryId : item.link.sourceEntryId)]

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="kicker">Links</h3>
        <EntrySelect entries={entries} excludeIds={excludeIds} label="Link an entry" onSelect={(id) => void onAdd(id)} />
      </div>
      {related.length === 0 ? (
        <p className="text-sm text-faint">Link a PC, NPC, location, or anything else in this campaign.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {related.map(({ link, other }) => (
            <li key={link.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-1">
              <span className="min-w-0 truncate text-sm">
                {other?.name ?? "Missing entry"}
                {other && (
                  <span className="ml-2 text-[10px] tracking-wide text-faint uppercase">
                    {sectionById(other.section).navLabel}
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Unlink ${other?.name ?? "entry"}`}
                className="text-muted hover:text-cream"
                onClick={() => setPending({ id: link.id, name: other?.name ?? "this entry" })}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending && (
        <ConfirmDialog
          title={`Unlink ${pending.name}?`}
          message={`${pending.name} stays in the campaign. Only this link is removed.`}
          confirmLabel="Unlink"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const id = pending.id
            setPending(null)
            void onRemove(id)
          }}
        />
      )}
    </section>
  )
}
