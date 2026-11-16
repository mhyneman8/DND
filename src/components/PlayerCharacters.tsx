import { ExternalLink, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { uid } from "../lib/ids.ts"
import { afflictionsOn } from "../lib/catalog.ts"
import { externalHref, orderByIds } from "../lib/pc.ts"
import { compareNames, formatSessionDate, messageOf } from "../lib/text.ts"
import type { Entry, PcEvent, PcSheet, RichDoc } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { AfflictionMark } from "./AfflictionMark.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntryLinks } from "./EntryLinks.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { PeopleList } from "./PeopleList.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, primaryClass, quietClass } from "./styles.ts"

const boxClass = "rounded-xl border border-line bg-black/15 p-3"
const tagFieldClass =
  "w-28 shrink-0 rounded-lg border border-line bg-black/25 px-3 py-2 text-sm text-cream outline-none placeholder:text-faint focus:border-[var(--campaign)]"

function todayTag() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return formatSessionDate(`${date.getFullYear()}-${month}-${day}`)
}

export function PlayerCharacters() {
  const { campaign, activeEntryId, entries, entriesLoadedFor, pcSheets, ensurePcSheet } = useApp()
  const ready = entriesLoadedFor === campaign?.id
  const entry = entries.find((item) => item.id === activeEntryId && item.section === "pcs" && item.campaignId === campaign?.id)
  const sheet = pcSheets.find((item) => item.entryId === entry?.id)

  useEffect(() => {
    if (!ready || !entry || sheet) return
    void ensurePcSheet(entry.id)
  }, [ready, entry, sheet, ensurePcSheet])

  if (!ready) return <p className="text-sm text-muted">Opening characters…</p>
  if (entry && !sheet) return <p className="text-sm text-muted">Opening this character…</p>
  if (entry && sheet) return <CharacterSheet key={entry.id} entry={entry} sheet={sheet} />
  return <CharacterList />
}

function CharacterList() {
  const { campaign, entries, links, createEntry, selectEntry } = useApp()
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const characters = entries
    .filter((entry) => entry.campaignId === campaign?.id && entry.section === "pcs")
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => compareNames(a.name, b.name))
  const hasCharacters = entries.some((entry) => entry.campaignId === campaign?.id && entry.section === "pcs")

  return (
    <div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          setError(null)
          void createEntry({ section: "pcs", name: next, subsection: "" })
            .then((created) => {
              setName("")
              selectEntry(created.id)
            })
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label="Character name"
          placeholder="Character name"
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
          aria-label="Search characters"
          placeholder="Search"
          className={`${fieldClass} mb-4`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {characters.length === 0 ? (
        <p className="text-sm text-muted">
          {query.trim() ? "No characters with that name." : "Add a player character to open their sheet."}
        </p>
      ) : (
        <ul>
          {characters.map((character) => (
            <li key={character.id}>
              <button
                type="button"
                onClick={() => selectEntry(character.id)}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
              >
                <span className="min-w-0 flex-1 truncate">{character.name}</span>
                <AfflictionMark entryId={character.id} entries={entries} links={links} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CharacterSheet({ entry, sheet }: { entry: Entry; sheet: PcSheet }) {
  const {
    entries,
    links,
    campaign,
    updateEntry,
    deleteEntry,
    uploadImage,
    deleteStoredImage,
    updatePcSheet,
    createLink,
    deleteLink,
  } = useApp()
  const [name, setName] = useState(entry.name)
  const [className, setClassName] = useState(sheet.className)
  const [subclass, setSubclass] = useState(sheet.subclass)
  const [sheetUrl, setSheetUrl] = useState(sheet.sheetUrl)
  const [sessionTag, setSessionTag] = useState(() => latestTag(sheet.events))
  const [eventText, setEventText] = useState("")
  const [objectiveText, setObjectiveText] = useState("")
  const [confirming, setConfirming] = useState(false)
  const fields = useAutosave(400)
  const nameQueue = useAutosave(400)
  const bioQueue = useAutosave(400)
  const notesQueue = useAutosave(400)
  const nameRef = useRef(name)
  const classRef = useRef(className)
  const subclassRef = useRef(subclass)
  const urlRef = useRef(sheetUrl)
  const href = externalHref(sheetUrl)
  const afflicted = afflictionsOn(entry.id, entries, links).length > 0
  const campaignEntries = entries.filter((item) => item.campaignId === campaign?.id)

  function saveFields() {
    fields(() => {
      void updatePcSheet(entry.id, () => ({
        className: classRef.current.trim(),
        subclass: subclassRef.current.trim(),
        sheetUrl: urlRef.current.trim(),
      }))
    })
  }

  function stamp() {
    const tag = sessionTag.trim() || todayTag()
    if (tag !== sessionTag) setSessionTag(tag)
    return tag
  }

  function addEvent() {
    const text = eventText.trim()
    if (!text) return
    const tag = stamp()
    setEventText("")
    void updatePcSheet(entry.id, (current) => ({
      events: [...current.events, { id: uid(), sessionTag: tag, text, createdAt: new Date().toISOString() }],
    }))
  }

  function addObjective() {
    const label = objectiveText.trim()
    if (!label) return
    setObjectiveText("")
    void updatePcSheet(entry.id, (current) => ({
      objectives: [...current.objectives, { id: uid(), label }],
    }))
  }

  function completeObjective(id: string) {
    const tag = stamp()
    void updatePcSheet(entry.id, (current) => {
      const objective = current.objectives.find((item) => item.id === id)
      if (!objective) return {}
      return {
        objectives: current.objectives.filter((item) => item.id !== id),
        events: [
          ...current.events,
          { id: uid(), sessionTag: tag, text: objective.label, createdAt: new Date().toISOString() },
        ],
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
      <input
        value={name}
        aria-label="Character name"
        className={`${fieldClass} min-w-0 flex-1 font-serif text-xl ${afflicted ? "!w-auto" : ""}`}
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
      <AfflictionMark entryId={entry.id} entries={entries} links={links} />
      </div>
      <ImageUpload
        path={entry.imagePath}
        alt={name || "Character portrait"}
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
        <h3 className="kicker mb-2">Background / Bio</h3>
        <RichTextField
          initialContent={sheet.bio}
          ariaLabel="Background and bio"
          placeholder="Where they came from, and who they are now."
          minHeight={140}
          onChange={(bio: RichDoc) => {
            bioQueue(() => {
              void updatePcSheet(entry.id, () => ({ bio }))
            })
          }}
        />
      </section>

      <section className={boxClass}>
        <h3 className="kicker">Class and subclass</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="kicker mb-1 block">Class</span>
            <input
              value={className}
              className={fieldClass}
              onChange={(event) => {
                const next = event.target.value
                classRef.current = next
                setClassName(next)
                saveFields()
              }}
              onBlur={() => {
                const next = className.trim()
                setClassName(next)
                classRef.current = next
                saveFields()
              }}
            />
          </label>
          <label className="block">
            <span className="kicker mb-1 block">Subclass</span>
            <input
              value={subclass}
              className={fieldClass}
              onChange={(event) => {
                const next = event.target.value
                subclassRef.current = next
                setSubclass(next)
                saveFields()
              }}
              onBlur={() => {
                const next = subclass.trim()
                setSubclass(next)
                subclassRef.current = next
                saveFields()
              }}
            />
          </label>
        </div>
        <div className="mt-3">
          <span className="kicker mb-1 block">Sheet link</span>
          <div className="flex gap-2">
            <input
              value={sheetUrl}
              aria-label="Sheet link"
              placeholder="https://roll20.net/…"
              className={fieldClass}
              onChange={(event) => {
                const next = event.target.value
                urlRef.current = next
                setSheetUrl(next)
                saveFields()
              }}
              onBlur={() => {
                const next = sheetUrl.trim()
                setSheetUrl(next)
                urlRef.current = next
                saveFields()
              }}
            />
            {href ? (
              <a className={`${quietClass} shrink-0 gap-1.5`} href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                Open
              </a>
            ) : (
              <button type="button" className={`${quietClass} shrink-0 gap-1.5`} disabled>
                <ExternalLink size={14} />
                Open
              </button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <h4 className="kicker mb-2">Subclass development</h4>
          <RichTextField
            initialContent={sheet.subclassNotes}
            ariaLabel="Subclass development"
            placeholder="How the subclass is changing."
            minHeight={110}
            onChange={(subclassNotes: RichDoc) => {
              notesQueue(() => {
                void updatePcSheet(entry.id, () => ({ subclassNotes }))
              })
            }}
          />
        </div>
      </section>

      <section className={boxClass}>
        <h3 className="kicker mb-2">Alliances / People known</h3>
        <PeopleList
          people={sheet.people}
          onAdd={(label) => {
            void updatePcSheet(entry.id, (current) => ({
              people: [...current.people, { id: uid(), label }],
            }))
          }}
          onRename={(id, label) => {
            void updatePcSheet(entry.id, (current) => ({
              people: current.people.map((person) => (person.id === id ? { ...person, label } : person)),
            }))
          }}
          onReorder={(ids) => {
            void updatePcSheet(entry.id, (current) => ({ people: orderByIds(current.people, ids) }))
          }}
          onDelete={(id) => {
            void updatePcSheet(entry.id, (current) => ({
              people: current.people.filter((person) => person.id !== id),
            }))
          }}
        />
      </section>

      <section className={boxClass}>
        <h3 className="kicker mb-2">Recent events</h3>
        <form
          className="mb-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            addEvent()
          }}
        >
          <input
            value={sessionTag}
            aria-label="Session tag"
            placeholder="Session"
            className={tagFieldClass}
            onChange={(event) => setSessionTag(event.target.value)}
          />
          <input
            value={eventText}
            aria-label="Recent event"
            placeholder="What happened, then Enter"
            className={fieldClass}
            onChange={(event) => setEventText(event.target.value)}
          />
        </form>
        <EventList
          events={[...sheet.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
          onUpdate={(id, patch) => {
            void updatePcSheet(entry.id, (current) => ({
              events: current.events.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            }))
          }}
          onDelete={(id) => {
            void updatePcSheet(entry.id, (current) => ({
              events: current.events.filter((item) => item.id !== id),
            }))
          }}
        />
      </section>

      <section className={boxClass}>
        <h3 className="kicker mb-2">Current personal objectives</h3>
        <p className="mb-2 text-xs text-faint">Check one to file it under recent events, using the session tag above.</p>
        {sheet.objectives.length === 0 ? (
          <p className="mb-2 text-sm text-faint">No open objectives.</p>
        ) : (
          <ul className="mb-2 flex flex-col gap-2">
            {sheet.objectives.map((objective) => (
              <ObjectiveRow
                key={objective.id}
                label={objective.label}
                onChange={(label) => {
                  void updatePcSheet(entry.id, (current) => ({
                    objectives: current.objectives.map((item) => (item.id === objective.id ? { ...item, label } : item)),
                  }))
                }}
                onComplete={() => completeObjective(objective.id)}
                onDelete={() => {
                  void updatePcSheet(entry.id, (current) => ({
                    objectives: current.objectives.filter((item) => item.id !== objective.id),
                  }))
                }}
              />
            ))}
          </ul>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            addObjective()
          }}
        >
          <input
            value={objectiveText}
            aria-label="New objective"
            placeholder="Type an objective and press Enter"
            className={fieldClass}
            onChange={(event) => setObjectiveText(event.target.value)}
          />
        </form>
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

function EventList({
  events,
  onUpdate,
  onDelete,
}: {
  events: PcEvent[]
  onUpdate: (id: string, patch: { sessionTag?: string; text?: string }) => void
  onDelete: (id: string) => void
}) {
  const [pending, setPending] = useState<PcEvent | null>(null)
  if (events.length === 0) return <p className="text-sm text-faint">No events yet.</p>
  return (
    <>
      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <EventRow key={event.id} event={event} onUpdate={onUpdate} onDelete={() => setPending(event)} />
        ))}
      </ul>
      {pending && (
        <ConfirmDialog
          title="Remove this event?"
          message="This removes it from recent events."
          confirmLabel="Remove"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const id = pending.id
            setPending(null)
            onDelete(id)
          }}
        />
      )}
    </>
  )
}

function EventRow({
  event,
  onUpdate,
  onDelete,
}: {
  event: PcEvent
  onUpdate: (id: string, patch: { sessionTag?: string; text?: string }) => void
  onDelete: () => void
}) {
  const [tag, setTag] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const tagValue = tag ?? event.sessionTag
  const textValue = text ?? event.text

  return (
    <li className="flex items-center gap-1">
      <input
        value={tagValue}
        aria-label="Session tag"
        className={tagFieldClass}
        onChange={(change) => setTag(change.target.value)}
        onBlur={() => {
          const next = tagValue.trim()
          setTag(null)
          if (next !== event.sessionTag) onUpdate(event.id, { sessionTag: next })
        }}
      />
      <input
        value={textValue}
        aria-label="Event"
        className={`${fieldClass} min-w-0`}
        onChange={(change) => setText(change.target.value)}
        onBlur={() => {
          const next = textValue.trim()
          setText(null)
          if (next && next !== event.text) onUpdate(event.id, { text: next })
        }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key !== "Enter") return
          keyEvent.preventDefault()
          keyEvent.currentTarget.blur()
        }}
      />
      <button
        type="button"
        aria-label={`Remove event ${event.text}`}
        className="inline-flex size-8 shrink-0 items-center justify-center text-muted hover:text-cream"
        onClick={onDelete}
      >
        <X size={16} />
      </button>
    </li>
  )
}

function ObjectiveRow({
  label,
  onChange,
  onComplete,
  onDelete,
}: {
  label: string
  onChange: (label: string) => void
  onComplete: () => void
  onDelete: () => void
}) {
  const [value, setValue] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const shown = value ?? label

  return (
    <li className="flex items-center gap-2">
      <input
        type="checkbox"
        aria-label={`Complete ${label}`}
        className="size-4 shrink-0 accent-[var(--campaign)]"
        onChange={() => onComplete()}
      />
      <input
        value={shown}
        aria-label={`Objective ${label}`}
        className={`${fieldClass} min-w-0`}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          const next = shown.trim()
          setValue(null)
          if (next && next !== label) onChange(next)
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          event.currentTarget.blur()
        }}
      />
      <button
        type="button"
        aria-label={`Remove ${label}`}
        className="inline-flex size-8 shrink-0 items-center justify-center text-muted hover:text-cream"
        onClick={() => setPending(true)}
      >
        <X size={16} />
      </button>
      {pending && (
        <ConfirmDialog
          title={`Remove ${label}?`}
          message="This removes the objective. It will not be filed under recent events."
          confirmLabel="Remove"
          onCancel={() => setPending(false)}
          onConfirm={() => {
            setPending(false)
            onDelete()
          }}
        />
      )}
    </li>
  )
}

function latestTag(events: PcEvent[]) {
  const latest = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return latest?.sessionTag ?? ""
}
