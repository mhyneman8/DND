import { Minus, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { uid } from "../lib/ids.ts"
import { AFFINITY_COLORS, AFFINITY_LABELS, affinityTone, moveFriendlyAt, moveHostileAt } from "../lib/npc.ts"
import { orderByIds } from "../lib/pc.ts"
import { compareNames, messageOf } from "../lib/text.ts"
import type { Entry, NpcSheet, RichDoc } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntryLinks } from "./EntryLinks.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { PeopleList } from "./PeopleList.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, iconButtonClass, primaryClass } from "./styles.ts"

const boxClass = "rounded-xl border border-line bg-black/15 p-3"

export function Npcs() {
  const { campaign, activeEntryId, entries, entriesLoadedFor, npcSheets, ensureNpcSheet } = useApp()
  const ready = entriesLoadedFor === campaign?.id
  const entry = entries.find((item) => item.id === activeEntryId && item.section === "npcs" && item.campaignId === campaign?.id)
  const sheet = npcSheets.find((item) => item.entryId === entry?.id)

  useEffect(() => {
    if (!ready || !entry || sheet) return
    void ensureNpcSheet(entry.id)
  }, [ready, entry, sheet, ensureNpcSheet])

  if (!ready) return <p className="text-sm text-muted">Opening characters…</p>
  if (entry && !sheet) return <p className="text-sm text-muted">Opening this character…</p>
  if (entry && sheet) return <NpcSheetView key={entry.id} entry={entry} sheet={sheet} />
  return <NpcList />
}

function NpcList() {
  const { campaign, entries, createEntry, selectEntry } = useApp()
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const characters = entries
    .filter((entry) => entry.campaignId === campaign?.id && entry.section === "npcs")
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => compareNames(a.name, b.name))
  const hasCharacters = entries.some((entry) => entry.campaignId === campaign?.id && entry.section === "npcs")

  return (
    <div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          setError(null)
          void createEntry({ section: "npcs", name: next, subsection: "" })
            .then((created) => {
              setName("")
              selectEntry(created.id)
            })
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label="NPC name"
          placeholder="NPC name"
          className={fieldClass}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={`${primaryClass} shrink-0`} disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {hasCharacters && (
        <input
          value={query}
          aria-label="Search NPCs"
          placeholder="Search"
          className={`${fieldClass} mb-4`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {characters.length === 0 ? (
        <p className="text-sm text-muted">{query.trim() ? "No NPCs with that name." : "Add an NPC to open their sheet."}</p>
      ) : (
        <ul>
          {characters.map((character) => (
            <li key={character.id}>
              <button
                type="button"
                onClick={() => selectEntry(character.id)}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
              >
                <span className="truncate">{character.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NpcSheetView({ entry, sheet }: { entry: Entry; sheet: NpcSheet }) {
  const {
    entries,
    links,
    campaign,
    updateEntry,
    deleteEntry,
    uploadImage,
    deleteStoredImage,
    updateNpcSheet,
    createLink,
    deleteLink,
  } = useApp()
  const [name, setName] = useState(entry.name)
  const [confirming, setConfirming] = useState(false)
  const nameQueue = useAutosave(400)
  const descriptionQueue = useAutosave(400)
  const motivationsQueue = useAutosave(400)
  const nameRef = useRef(name)
  const tone = affinityTone(sheet.affinity, sheet.hostileAt, sheet.friendlyAt)
  const color = AFFINITY_COLORS[tone]
  const campaignEntries = entries.filter((item) => item.campaignId === campaign?.id)

  function setAffinity(next: number) {
    void updateNpcSheet(entry.id, () => ({ affinity: Math.trunc(next) }))
  }

  function stepAffinity(delta: number) {
    void updateNpcSheet(entry.id, (current) => ({ affinity: current.affinity + delta }))
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={name}
        aria-label="NPC name"
        className={`${fieldClass} font-serif text-xl`}
        onChange={(event) => {
          const next = event.target.value
          setName(next)
          nameRef.current = next
          nameQueue(() => {
            const trimmed = nameRef.current.trim()
            if (!trimmed) return
            void updateEntry(entry.id, { name: trimmed })
          })
        }}
        onBlur={() => {
          const next = name.trim()
          if (!next) {
            setName(entry.name)
            nameRef.current = entry.name
            return
          }
          setName(next)
          nameRef.current = next
          void updateEntry(entry.id, { name: next })
        }}
      />
      <ImageUpload
        path={entry.imagePath}
        alt={name || "NPC portrait"}
        onUpload={async (file) => {
          const path = await uploadImage(file)
          const previous = entry.imagePath
          await updateEntry(entry.id, { imagePath: path })
          if (previous && previous !== path) await deleteStoredImage(previous)
        }}
        onRemove={async () => {
          const previous = entry.imagePath
          await updateEntry(entry.id, { imagePath: null })
          if (previous) await deleteStoredImage(previous)
        }}
      />

      <section className={boxClass}>
        <h3 className="kicker mb-2">Description</h3>
        <RichTextField
          initialContent={sheet.description}
          ariaLabel="Description"
          placeholder="Who they are, and how they show up."
          minHeight={140}
          onChange={(description: RichDoc) => {
            descriptionQueue(() => {
              void updateNpcSheet(entry.id, () => ({ description }))
            })
          }}
        />
      </section>

      <section className={boxClass}>
        <h3 className="kicker mb-2">Motivations</h3>
        <RichTextField
          initialContent={sheet.motivations}
          ariaLabel="Motivations"
          placeholder="What they want, and what they will not give up."
          minHeight={120}
          onChange={(motivations: RichDoc) => {
            motivationsQueue(() => {
              void updateNpcSheet(entry.id, () => ({ motivations }))
            })
          }}
        />
      </section>

      <section className={boxClass}>
        <h3 className="kicker mb-3">Affinity</h3>
        <div className="flex items-center justify-center gap-3">
          <button type="button" className={iconButtonClass} aria-label="Lower affinity" onClick={() => stepAffinity(-1)}>
            <Minus size={16} />
          </button>
          <div className="text-center">
            <IntegerField
              value={sheet.affinity}
              label="Affinity"
              className="w-24 bg-transparent text-center font-serif text-4xl tabular-nums outline-none"
              style={{ color }}
              onCommit={setAffinity}
            />
            <p className="text-xs tracking-wide uppercase" style={{ color }}>
              {AFFINITY_LABELS[tone]}
            </p>
          </div>
          <button type="button" className={iconButtonClass} aria-label="Raise affinity" onClick={() => stepAffinity(1)}>
            <Plus size={16} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-xs text-muted">
              <span className="size-2 rounded-full" style={{ background: AFFINITY_COLORS.hostile }} />
              Red at or below
            </span>
            <IntegerField
              value={sheet.hostileAt}
              label="Red at or below"
              className={fieldClass}
              onCommit={(next) => {
                void updateNpcSheet(entry.id, (current) => moveHostileAt(current.friendlyAt, next))
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-xs text-muted">
              <span className="size-2 rounded-full" style={{ background: AFFINITY_COLORS.friendly }} />
              Green at or above
            </span>
            <IntegerField
              value={sheet.friendlyAt}
              label="Green at or above"
              className={fieldClass}
              onCommit={(next) => {
                void updateNpcSheet(entry.id, (current) => moveFriendlyAt(current.hostileAt, next))
              }}
            />
          </label>
        </div>
      </section>

      <section className={boxClass}>
        <h3 className="kicker mb-2">Alliances / People known</h3>
        <PeopleList
          people={sheet.people}
          onAdd={(label) => {
            void updateNpcSheet(entry.id, (current) => ({
              people: [...current.people, { id: uid(), label }],
            }))
          }}
          onRename={(id, label) => {
            void updateNpcSheet(entry.id, (current) => ({
              people: current.people.map((person) => (person.id === id ? { ...person, label } : person)),
            }))
          }}
          onReorder={(ids) => {
            void updateNpcSheet(entry.id, (current) => ({ people: orderByIds(current.people, ids) }))
          }}
          onDelete={(id) => {
            void updateNpcSheet(entry.id, (current) => ({
              people: current.people.filter((person) => person.id !== id),
            }))
          }}
        />
      </section>

      <EntryLinks
        entryId={entry.id}
        entries={campaignEntries}
        links={links.filter((link) => link.campaignId === campaign?.id)}
        onAdd={createLink}
        onRemove={deleteLink}
      />

      <div className="border-t border-line pt-3">
        <button type="button" className="text-sm text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Delete character
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${entry.name}?`}
          message={`“${entry.name}” will be removed from this campaign.`}
          confirmLabel="Delete character"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void deleteEntry(entry.id)
          }}
        />
      )}
    </div>
  )
}

function IntegerField({
  value,
  label,
  className,
  style,
  onCommit,
}: {
  value: number
  label: string
  className: string
  style?: { color: string }
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const parsed = draft !== null && /^-?\d+$/.test(draft) ? Number(draft) : null
  const shown = parsed !== null && parsed !== value ? String(value) : (draft ?? String(value))
  return (
    <input
      value={shown}
      aria-label={label}
      inputMode="numeric"
      className={className}
      style={style}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (/^-?\d+$/.test(next)) onCommit(Number(next))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
