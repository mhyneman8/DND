import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { linkedEntries } from "../lib/catalog.ts"
import { sectionById } from "../lib/sections.ts"
import { compareNames, messageOf } from "../lib/text.ts"
import type { CatalogSheet, Entry, EntryLink, PanelSectionId, RichDoc } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntryLinks } from "./EntryLinks.tsx"
import { EntrySelect } from "./EntrySelect.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, primaryClass } from "./styles.ts"

const boxClass = "rounded-xl border border-line bg-black/15 p-3"

type CatalogSectionId = "afflictions" | "locations" | "misc"

const COPY: Record<
  CatalogSectionId,
  { add: string; search: string; empty: string; missing: string; opening: string; openingOne: string; name: string }
> = {
  afflictions: {
    add: "Affliction name",
    search: "Search afflictions",
    empty: "Add an affliction to open its sheet.",
    missing: "No afflictions with that name.",
    opening: "Opening afflictions…",
    openingOne: "Opening this affliction…",
    name: "Affliction name",
  },
  locations: {
    add: "Place name",
    search: "Search places",
    empty: "Add a place to open its sheet.",
    missing: "No places with that name.",
    opening: "Opening places…",
    openingOne: "Opening this place…",
    name: "Place name",
  },
  misc: {
    add: "Item name",
    search: "Search items",
    empty: "Add an item to open its sheet.",
    missing: "No items with that name.",
    opening: "Opening items…",
    openingOne: "Opening this item…",
    name: "Item name",
  },
}

export function CatalogSection({ section }: { section: CatalogSectionId }) {
  const { campaign, activeEntryId, entries, entriesLoadedFor, catalogSheets, ensureCatalogSheet } = useApp()
  const ready = entriesLoadedFor === campaign?.id
  const entry = entries.find((item) => item.id === activeEntryId && item.section === section && item.campaignId === campaign?.id)
  const sheet = catalogSheets.find((item) => item.entryId === entry?.id)
  const copy = COPY[section]

  useEffect(() => {
    if (!ready || !entry || sheet) return
    void ensureCatalogSheet(entry.id)
  }, [ready, entry, sheet, ensureCatalogSheet])

  if (!ready) return <p className="text-sm text-muted">{copy.opening}</p>
  if (entry && !sheet) return <p className="text-sm text-muted">{copy.openingOne}</p>
  if (entry && sheet) return <CatalogSheetView key={entry.id} entry={entry} sheet={sheet} />
  return <CatalogList section={section} />
}

function CatalogList({ section }: { section: CatalogSectionId }) {
  const { campaign, entries, createEntry, selectEntry } = useApp()
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[section]
  const records = entries
    .filter((entry) => entry.campaignId === campaign?.id && entry.section === section)
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => compareNames(a.name, b.name))
  const hasRecords = entries.some((entry) => entry.campaignId === campaign?.id && entry.section === section)

  return (
    <div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          setError(null)
          void createEntry({ section, name: next, subsection: "" })
            .then((created) => {
              setName("")
              selectEntry(created.id)
            })
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label={copy.add}
          placeholder={copy.add}
          className={fieldClass}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={`${primaryClass} shrink-0`} disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {hasRecords && (
        <input
          value={query}
          aria-label={copy.search}
          placeholder="Search"
          className={`${fieldClass} mb-4`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {records.length === 0 ? (
        <p className="text-sm text-muted">{query.trim() ? copy.missing : copy.empty}</p>
      ) : (
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => selectEntry(record.id)}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
              >
                <span className="truncate">{record.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CatalogSheetView({ entry, sheet }: { entry: Entry; sheet: CatalogSheet }) {
  const {
    entries,
    links,
    campaign,
    updateEntry,
    deleteEntry,
    uploadImage,
    deleteStoredImage,
    updateCatalogSheet,
    createLink,
    deleteLink,
    openEntry,
  } = useApp()
  const copy = COPY[entry.section as CatalogSectionId]
  const [name, setName] = useState(entry.name)
  const [savingThrow, setSavingThrow] = useState(sheet.savingThrow)
  const [damage, setDamage] = useState(sheet.damage)
  const [place, setPlace] = useState(sheet.place)
  const [effect, setEffect] = useState(sheet.effect)
  const [confirming, setConfirming] = useState(false)
  const nameQueue = useAutosave(400)
  const fields = useAutosave(400)
  const notesQueue = useAutosave(400)
  const nameRef = useRef(name)
  const savingRef = useRef(savingThrow)
  const damageRef = useRef(damage)
  const placeRef = useRef(place)
  const effectRef = useRef(effect)
  const campaignEntries = entries.filter((item) => item.campaignId === campaign?.id)
  const campaignLinks = links.filter((link) => link.campaignId === campaign?.id)
  const specialSections: PanelSectionId[] =
    sheet.kind === "affliction" ? ["pcs", "npcs"] : sheet.kind === "location" ? ["npcs"] : []
  const special = linkedEntries(entry.id, campaignEntries, campaignLinks, specialSections)
  const specialIds = new Set(special.map((item) => item.link.id))
  const otherLinks = campaignLinks.filter((link) => !specialIds.has(link.id))

  function saveFields() {
    fields(() => {
      void updateCatalogSheet(entry.id, () => ({
        savingThrow: savingRef.current.trim(),
        damage: damageRef.current.trim(),
        place: placeRef.current.trim(),
        effect: effectRef.current.trim(),
      }))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={name}
        aria-label={copy.name}
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
        alt={name || copy.name}
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

      {sheet.kind === "affliction" && (
        <section className={boxClass}>
          <h3 className="kicker">Saving throw</h3>
          <input
            value={savingThrow}
            aria-label="Saving throw"
            placeholder="Constitution DC 14"
            className={`${fieldClass} mt-3`}
            onChange={(event) => {
              const next = event.target.value
              setSavingThrow(next)
              savingRef.current = next
              saveFields()
            }}
            onBlur={() => {
              const next = savingThrow.trim()
              setSavingThrow(next)
              savingRef.current = next
              saveFields()
            }}
          />
          <h3 className="kicker mt-4">Damage</h3>
          <input
            value={damage}
            aria-label="Damage"
            placeholder="Optional"
            className={`${fieldClass} mt-3`}
            onChange={(event) => {
              const next = event.target.value
              setDamage(next)
              damageRef.current = next
              saveFields()
            }}
            onBlur={() => {
              const next = damage.trim()
              setDamage(next)
              damageRef.current = next
              saveFields()
            }}
          />
        </section>
      )}

      {sheet.kind === "location" && (
        <section className={boxClass}>
          <h3 className="kicker">Location</h3>
          <input
            value={place}
            aria-label="Location"
            placeholder="Where it sits"
            className={`${fieldClass} mt-3`}
            onChange={(event) => {
              const next = event.target.value
              setPlace(next)
              placeRef.current = next
              saveFields()
            }}
            onBlur={() => {
              const next = place.trim()
              setPlace(next)
              placeRef.current = next
              saveFields()
            }}
          />
        </section>
      )}

      {sheet.kind === "item" && (
        <section className={boxClass}>
          <h3 className="kicker">Effect</h3>
          <textarea
            value={effect}
            aria-label="Effect"
            placeholder="What it does when used."
            rows={3}
            className={`${fieldClass} mt-3 resize-y`}
            onChange={(event) => {
              const next = event.target.value
              setEffect(next)
              effectRef.current = next
              saveFields()
            }}
            onBlur={() => {
              const next = effect.trim()
              setEffect(next)
              effectRef.current = next
              saveFields()
            }}
          />
        </section>
      )}

      <section className={boxClass}>
        <h3 className="kicker mb-2">{sheet.kind === "location" ? "Events / Info" : "Description"}</h3>
        <RichTextField
          initialContent={sheet.notes}
          ariaLabel={sheet.kind === "location" ? "Events and info" : "Description"}
          placeholder={
            sheet.kind === "affliction"
              ? "How it takes hold, and how it ends."
              : sheet.kind === "location"
                ? "What has happened here, and what a visitor finds."
                : "What it looks like, and who carries it."
          }
          minHeight={140}
          onChange={(notes: RichDoc) => {
            notesQueue(() => {
              void updateCatalogSheet(entry.id, () => ({ notes }))
            })
          }}
        />
      </section>

      {sheet.kind === "affliction" && (
        <LinkedEntries
          title="Characters"
          addLabel="Link a character"
          empty="No characters linked yet."
          entries={campaignEntries.filter((item) => item.section === "pcs" || item.section === "npcs")}
          linked={special}
          onOpen={openEntry}
          onAdd={createLink}
          onRemove={deleteLink}
        />
      )}

      {sheet.kind === "location" && (
        <LinkedEntries
          title="NPCs"
          addLabel="Link an NPC"
          empty="No NPCs linked to this place."
          entries={campaignEntries.filter((item) => item.section === "npcs")}
          linked={special}
          onOpen={openEntry}
          onAdd={createLink}
          onRemove={deleteLink}
        />
      )}

      <EntryLinks
        entryId={entry.id}
        entries={campaignEntries}
        links={otherLinks}
        onAdd={createLink}
        onRemove={deleteLink}
      />

      <div className="border-t border-line pt-3">
        <button type="button" className="text-sm text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Delete entry
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${entry.name}?`}
          message={`“${entry.name}” will be removed from this campaign.`}
          confirmLabel="Delete entry"
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

function LinkedEntries({
  title,
  addLabel,
  empty,
  entries,
  linked,
  onOpen,
  onAdd,
  onRemove,
}: {
  title: string
  addLabel: string
  empty: string
  entries: Entry[]
  linked: { link: EntryLink; entry: Entry }[]
  onOpen: (entry: Entry) => void
  onAdd: (targetId: string) => Promise<void>
  onRemove: (linkId: string) => Promise<void>
}) {
  const [pending, setPending] = useState<Entry | null>(null)
  return (
    <section className={boxClass}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="kicker">{title}</h3>
        <EntrySelect
          entries={entries}
          excludeIds={linked.map((item) => item.entry.id)}
          label={addLabel}
          onSelect={(id) => void onAdd(id)}
        />
      </div>
      {linked.length === 0 ? (
        <p className="text-sm text-faint">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {linked.map(({ link, entry }) => (
            <li key={link.id} className="flex items-center gap-2 rounded-md px-1 py-1">
              <button
                type="button"
                onClick={() => onOpen(entry)}
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-[var(--campaign)]"
              >
                {entry.name}
                <span className="ml-2 text-[10px] tracking-wide text-faint uppercase">{sectionById(entry.section).navLabel}</span>
              </button>
              <button
                type="button"
                aria-label={`Unlink ${entry.name}`}
                className="text-muted hover:text-cream"
                onClick={() => setPending(entry)}
              >
                <X size={14} />
              </button>
              {pending?.id === entry.id && (
                <ConfirmDialog
                  title={`Unlink ${entry.name}?`}
                  message={`${entry.name} stays in the campaign. Only this link is removed.`}
                  confirmLabel="Unlink"
                  onCancel={() => setPending(null)}
                  onConfirm={() => {
                    setPending(null)
                    void onRemove(link.id)
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
