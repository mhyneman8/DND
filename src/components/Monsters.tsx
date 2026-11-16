import { ExternalLink } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { uid } from "../lib/ids.ts"
import {
  abilityModifier,
  challengeLabel,
  draftToPatch,
  parseCompendium,
  searchCompendium,
  type CompendiumCreature,
  type MonsterDraft,
} from "../lib/monster.ts"
import { notesPlaceholder } from "../lib/sections.ts"
import { compareNames, messageOf } from "../lib/text.ts"
import type { AbilityScores, Entry, MonsterSheet, RichDoc, StatLine } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntryLinks } from "./EntryLinks.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, primaryClass, quietClass } from "./styles.ts"

const ENCOUNTER_URL = "https://redcap.press/encounters"
const MAX_IMPORT = 400

const ABILITIES: { key: keyof AbilityScores; label: string }[] = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
]

type LineKey = "traits" | "actions" | "bonusActions" | "reactions" | "legendaryActions"

const LINE_GROUPS: { key: LineKey; title: string; add: string; optional?: boolean }[] = [
  { key: "traits", title: "Traits", add: "Add trait" },
  { key: "actions", title: "Actions", add: "Add action" },
  { key: "bonusActions", title: "Bonus Actions", add: "Add bonus action", optional: true },
  { key: "reactions", title: "Reactions", add: "Add reaction", optional: true },
  { key: "legendaryActions", title: "Legendary Actions", add: "Add legendary action", optional: true },
]

const EXTRA_LINES: { key: keyof Scalars; label: string }[] = [
  { key: "savingThrows", label: "Saving Throws" },
  { key: "skills", label: "Skills" },
  { key: "damageVulnerabilities", label: "Damage Vulnerabilities" },
  { key: "damageResistances", label: "Damage Resistances" },
  { key: "damageImmunities", label: "Damage Immunities" },
  { key: "conditionImmunities", label: "Condition Immunities" },
]

type Scalars = {
  size: string
  creatureType: string
  alignment: string
  armorClass: string
  hitPoints: string
  speed: string
  savingThrows: string
  skills: string
  damageVulnerabilities: string
  damageResistances: string
  damageImmunities: string
  conditionImmunities: string
  senses: string
  languages: string
  challenge: string
  source: string
}

export function Monsters() {
  const { campaign, activeEntryId, entries, entriesLoadedFor, monsterSheets, ensureMonsterSheet } = useApp()
  const ready = entriesLoadedFor === campaign?.id
  const entry = entries.find((item) => item.id === activeEntryId && item.section === "monsters" && item.campaignId === campaign?.id)
  const sheet = monsterSheets.find((item) => item.entryId === entry?.id)

  useEffect(() => {
    if (!ready || !entry || sheet) return
    void ensureMonsterSheet(entry.id)
  }, [ready, entry, sheet, ensureMonsterSheet])

  if (!ready) return <p className="text-sm text-muted">Opening monsters…</p>
  if (entry && !sheet) return <p className="text-sm text-muted">Opening this stat block…</p>
  if (entry && sheet) return <MonsterSheetView key={entry.id} entry={entry} sheet={sheet} />
  return <MonsterList />
}

function MonsterList() {
  const { campaign, entries, monsterSheets, createEntry, selectEntry, updateMonsterSheet } = useApp()
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const creatures = entries
    .filter((entry) => entry.campaignId === campaign?.id && entry.section === "monsters")
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => compareNames(a.name, b.name))
  const hasCreatures = entries.some((entry) => entry.campaignId === campaign?.id && entry.section === "monsters")

  return (
    <div>
      {builderOpen ? (
        <EncounterBuilder onClose={() => setBuilderOpen(false)} />
      ) : (
        <button type="button" className={`${quietClass} mb-4 w-full`} onClick={() => setBuilderOpen(true)}>
          Encounter builder
        </button>
      )}
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          setError(null)
          void createEntry({ section: "monsters", name: next, subsection: "" })
            .then((created) => {
              setName("")
              selectEntry(created.id)
            })
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label="Creature name"
          placeholder="Creature name"
          className={fieldClass}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={`${primaryClass} shrink-0`} disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <CompendiumImport
        existingNames={entries
          .filter((entry) => entry.campaignId === campaign?.id && entry.section === "monsters")
          .map((entry) => entry.name)}
        onAdd={async (draft) => {
          const entry = await createEntry({ section: "monsters", name: draft.name, subsection: "" })
          await updateMonsterSheet(entry.id, () => draftToPatch(draft))
          return entry.id
        }}
        onDone={(ids) => {
          if (ids.length === 1) selectEntry(ids[0])
        }}
      />
      {hasCreatures && (
        <input
          value={query}
          aria-label="Search monsters"
          placeholder="Search"
          className={`${fieldClass} mb-4`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {creatures.length === 0 ? (
        <p className="text-sm text-muted">{query.trim() ? "No creatures with that name." : "Add a creature to open its stat block."}</p>
      ) : (
        <ul>
          {creatures.map((creature) => {
            const sheet = monsterSheets.find((item) => item.entryId === creature.id)
            const challenge = sheet ? challengeLabel(sheet.challenge) : ""
            const detail = [sheet?.size, sheet?.creatureType].filter(Boolean).join(" ")
            const meta = [challenge ? `CR ${challenge}` : "", detail, creature.subsection].filter(Boolean).join(" · ")
            return (
              <li key={creature.id}>
                <button
                  type="button"
                  onClick={() => selectEntry(creature.id)}
                  className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                >
                  <span className="truncate">{creature.name}</span>
                  {meta && <span className="truncate text-xs text-faint">{meta}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function EncounterBuilder({ onClose }: { onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const loaded = useRef(false)
  const [embedded, setEmbedded] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!loaded.current) setEmbedded(false)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [])

  function onLoad() {
    const frame = frameRef.current
    if (!frame) return
    try {
      const href = frame.contentWindow?.location.href ?? ""
      if (!href || href === "about:blank" || href.startsWith("chrome-error:")) {
        loaded.current = false
        setEmbedded(false)
        return
      }
    } catch {
      // A cross-origin page loaded inside the frame.
    }
    loaded.current = true
    setEmbedded(true)
  }

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="kicker">Encounter builder</h3>
        <button type="button" className="text-sm text-muted hover:text-cream" onClick={onClose}>
          Hide
        </button>
      </div>
      {embedded ? (
        <>
          <iframe
            ref={frameRef}
            className="encounter-frame h-[70vh] w-full rounded-xl border border-line bg-white"
            title="Redcap Press encounter builder"
            src={ENCOUNTER_URL}
            onLoad={onLoad}
            onError={() => {
              loaded.current = false
              setEmbedded(false)
            }}
          />
          <a
            className="mt-2 inline-flex items-center gap-1 text-sm text-muted hover:text-cream"
            href={ENCOUNTER_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open in a new tab
            <ExternalLink size={14} />
          </a>
        </>
      ) : (
        <div className="rounded-xl border border-line bg-black/20 p-4">
          <p className="mb-3 text-sm text-muted">The encounter builder can’t be shown in this panel.</p>
          <a className={`${primaryClass} gap-2`} href={ENCOUNTER_URL} target="_blank" rel="noreferrer">
            Open encounter builder
            <ExternalLink size={15} />
          </a>
        </div>
      )}
    </section>
  )
}

function CompendiumImport({
  existingNames,
  onAdd,
  onDone,
}: {
  existingNames: string[]
  onAdd: (draft: MonsterDraft) => Promise<string>
  onDone: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [hits, setHits] = useState<CompendiumCreature[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const known = new Set(existingNames.map((name) => name.toLowerCase()))
  const query = search.trim()
  const canSearch = query.length >= 2

  useEffect(() => {
    if (!canSearch) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearching(true)
      void searchCompendium(query)
        .then((next) => {
          if (!cancelled) setHits(next)
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(messageOf(caught))
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, canSearch])

  async function importDrafts(drafts: MonsterDraft[]) {
    const batch = drafts.slice(0, MAX_IMPORT)
    setBusy(true)
    setError(null)
    const ids: string[] = []
    try {
      for (const [index, draft] of batch.entries()) {
        setStatus(batch.length > 1 ? `Importing ${index + 1} of ${batch.length}…` : "Importing…")
        ids.push(await onAdd(draft))
      }
      const leftover = drafts.length - batch.length
      setStatus(
        leftover > 0
          ? `Imported ${batch.length} creatures. ${leftover} more stayed in the file.`
          : batch.length === 1
            ? `Imported ${batch[0].name}.`
            : `Imported ${batch.length} creatures.`,
      )
      if (batch.length === 1) onDone(ids)
    } catch (caught) {
      setStatus(ids.length > 0 ? `Imported ${ids.length} before the compendium stopped.` : null)
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className={`${quietClass} mb-4 w-full`} onClick={() => setOpen(true)}>
        Import from compendium
      </button>
    )
  }

  return (
    <section className="mb-4 rounded-xl border border-line bg-black/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="kicker">Compendium</h3>
        <button type="button" className="text-sm text-muted hover:text-cream" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="mb-3 text-sm text-muted">Search the System Reference Document, or import a JSON file of stat blocks.</p>
      <input
        value={search}
        aria-label="Search the compendium"
        placeholder="Search creatures"
        className={fieldClass}
        onChange={(event) => {
          const next = event.target.value
          setSearch(next)
          setHits([])
          setSearching(next.trim().length >= 2)
          setError(null)
          setStatus(null)
        }}
      />
      {canSearch && searching && <p className="mt-2 text-sm text-faint">Searching…</p>}
      {canSearch && hits.length > 0 && (
        <ul className="mt-2">
          {hits.map((hit) => (
            <li key={hit.key} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{hit.name}</span>
                <span className="block truncate text-xs text-faint">
                  {[hit.challenge ? `CR ${hit.challenge}` : "", hit.detail, hit.source, known.has(hit.name.toLowerCase()) ? "In this campaign" : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <button type="button" className={`${quietClass} shrink-0 px-2 py-1`} disabled={busy} onClick={() => void importDrafts([hit.draft])}>
                Import
              </button>
            </li>
          ))}
        </ul>
      )}
      {canSearch && !searching && hits.length === 0 && !error && (
        <p className="mt-2 text-sm text-muted">No SRD creatures with that name.</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Compendium JSON file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (!file) return
            void readCompendium(file)
              .then((drafts) => importDrafts(drafts))
              .catch((caught: unknown) => setError(messageOf(caught)))
          }}
        />
        <button type="button" className={quietClass} disabled={busy} onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
      </div>
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}

function readCompendium(file: File) {
  return new Promise<MonsterDraft[]>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const drafts = parseCompendium(JSON.parse(String(reader.result)))
        if (drafts.length === 0) reject(new Error("That file has no stat blocks."))
        else resolve(drafts)
      } catch (caught) {
        reject(caught instanceof SyntaxError ? new Error("That file isn't JSON.") : caught)
      }
    }
    reader.onerror = () => reject(new Error("That file couldn't be read."))
    reader.readAsText(file)
  })
}

function MonsterSheetView({ entry, sheet }: { entry: Entry; sheet: MonsterSheet }) {
  const { entries, links, campaign, updateEntry, deleteEntry, uploadImage, deleteStoredImage, updateMonsterSheet, createLink, deleteLink } =
    useApp()
  const [name, setName] = useState(entry.name)
  const [scalars, setScalars] = useState<Scalars>(() => scalarFields(sheet))
  const [abilities, setAbilities] = useState<AbilityScores>(sheet.abilities)
  const [lines, setLines] = useState(() => lineFields(sheet))
  const [extraOpen, setExtraOpen] = useState<Partial<Record<keyof Scalars, boolean>>>({})
  const [confirming, setConfirming] = useState(false)
  const [pendingLine, setPendingLine] = useState<{ key: LineKey; id: string; title: string } | null>(null)
  const nameRef = useRef(name)
  const scalarRef = useRef(scalars)
  const abilityRef = useRef(abilities)
  const lineRef = useRef(lines)
  const nameQueue = useAutosave(400)
  const statQueue = useAutosave(400)
  const lineQueue = useAutosave(400)
  const notesQueue = useAutosave(400)
  const campaignEntries = entries.filter((item) => item.campaignId === campaign?.id)

  function saveStats() {
    statQueue(() => {
      void updateMonsterSheet(entry.id, () => ({ ...scalarRef.current, abilities: abilityRef.current }))
    })
  }

  function editScalar<K extends keyof Scalars>(key: K, value: Scalars[K]) {
    const next = { ...scalarRef.current, [key]: value }
    scalarRef.current = next
    setScalars(next)
    saveStats()
  }

  function editAbility(key: keyof AbilityScores, value: number) {
    const next = { ...abilityRef.current, [key]: value }
    abilityRef.current = next
    setAbilities(next)
    saveStats()
  }

  function editLines(key: LineKey, nextLines: StatLine[]) {
    const next = { ...lineRef.current, [key]: nextLines }
    lineRef.current = next
    setLines(next)
    lineQueue(() => {
      void updateMonsterSheet(entry.id, () => ({ ...lineRef.current }))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ImageUpload
        path={entry.imagePath}
        alt={name || "Creature"}
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

      <article className="stat-block">
        <input
          value={name}
          aria-label="Creature name"
          className="stat-name"
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
        <p className="stat-meta">
          <input
            aria-label="Size"
            value={scalars.size}
            placeholder="Medium"
            size={Math.max(scalars.size.length, 6)}
            onChange={(event) => editScalar("size", event.target.value)}
          />{" "}
          <input
            aria-label="Creature type"
            value={scalars.creatureType}
            placeholder="humanoid"
            size={Math.max(scalars.creatureType.length, 8)}
            onChange={(event) => editScalar("creatureType", event.target.value)}
          />
          {", "}
          <input
            aria-label="Alignment"
            value={scalars.alignment}
            placeholder="alignment"
            size={Math.max(scalars.alignment.length, 9)}
            onChange={(event) => editScalar("alignment", event.target.value)}
          />
        </p>
        <div className="stat-rule" />
        <StatText label="Armor Class" value={scalars.armorClass} onChange={(value) => editScalar("armorClass", value)} />
        <StatText label="Hit Points" value={scalars.hitPoints} onChange={(value) => editScalar("hitPoints", value)} />
        <StatText label="Speed" value={scalars.speed} onChange={(value) => editScalar("speed", value)} />
        <div className="stat-scores">
          {ABILITIES.map((ability) => (
            <ScoreCell key={ability.key} label={ability.label} score={abilities[ability.key]} onCommit={(value) => editAbility(ability.key, value)} />
          ))}
        </div>
        {EXTRA_LINES.filter((line) => scalars[line.key].trim() || extraOpen[line.key]).map((line) => (
          <StatText key={line.key} label={line.label} value={scalars[line.key]} onChange={(value) => editScalar(line.key, value)} />
        ))}
        <StatText label="Senses" value={scalars.senses} onChange={(value) => editScalar("senses", value)} />
        <StatText label="Languages" value={scalars.languages} onChange={(value) => editScalar("languages", value)} />
        <StatText label="Challenge" value={scalars.challenge} onChange={(value) => editScalar("challenge", value)} />
        {EXTRA_LINES.some((line) => !scalars[line.key].trim() && !extraOpen[line.key]) && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {EXTRA_LINES.filter((line) => !scalars[line.key].trim() && !extraOpen[line.key]).map((line) => (
              <button key={line.key} type="button" className="stat-add" onClick={() => setExtraOpen((current) => ({ ...current, [line.key]: true }))}>
                Add {line.label.toLowerCase()}
              </button>
            ))}
          </div>
        )}

        {LINE_GROUPS.filter((group) => !group.optional || lines[group.key].length > 0).map((group) => (
          <section key={group.key}>
            <h3 className="stat-heading">
              {group.title}
              <button
                type="button"
                className="stat-add"
                onClick={() => editLines(group.key, [...lines[group.key], { id: uid(), name: "", text: "" }])}
              >
                {group.add}
              </button>
            </h3>
            {lines[group.key].map((line) => (
              <div key={line.id} className="stat-trait">
                <button
                  type="button"
                  className="stat-remove"
                  aria-label={`Remove ${line.name || group.title}`}
                  onClick={() => {
                    if (!line.name.trim() && !line.text.trim()) {
                      editLines(group.key, lines[group.key].filter((item) => item.id !== line.id))
                      return
                    }
                    setPendingLine({ key: group.key, id: line.id, title: line.name.trim() || group.title })
                  }}
                >
                  ×
                </button>
                <input
                  aria-label={`${group.title} name`}
                  value={line.name}
                  placeholder="Name"
                  onChange={(event) =>
                    editLines(
                      group.key,
                      lines[group.key].map((item) => (item.id === line.id ? { ...item, name: event.target.value } : item)),
                    )
                  }
                />
                <textarea
                  aria-label={`${group.title} description`}
                  value={line.text}
                  placeholder="What it does."
                  rows={Math.min(8, Math.max(2, Math.ceil(line.text.length / 90)))}
                  onChange={(event) =>
                    editLines(
                      group.key,
                      lines[group.key].map((item) => (item.id === line.id ? { ...item, text: event.target.value } : item)),
                    )
                  }
                />
              </div>
            ))}
          </section>
        ))}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {LINE_GROUPS.filter((group) => group.optional && lines[group.key].length === 0).map((group) => (
            <button
              key={group.key}
              type="button"
              className="stat-add"
              onClick={() => editLines(group.key, [{ id: uid(), name: "", text: "" }])}
            >
              {group.add}
            </button>
          ))}
        </div>
        <p className="stat-source">
          Source{" "}
          <input
            aria-label="Source"
            value={scalars.source}
            placeholder="homebrew"
            onChange={(event) => editScalar("source", event.target.value)}
          />
        </p>
      </article>

      <section>
        <h3 className="kicker mb-2">At the table</h3>
        <RichTextField
          initialContent={sheet.notes}
          ariaLabel="Table notes"
          placeholder={notesPlaceholder("monsters")}
          minHeight={120}
          onChange={(notes: RichDoc) => {
            notesQueue(() => {
              void updateMonsterSheet(entry.id, () => ({ notes }))
            })
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
          Delete creature
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${entry.name}?`}
          message={`“${entry.name}” will be removed from this campaign.`}
          confirmLabel="Delete creature"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void deleteEntry(entry.id)
          }}
        />
      )}
      {pendingLine && (
        <ConfirmDialog
          title={`Remove ${pendingLine.title}?`}
          message="This line will come off the stat block."
          confirmLabel="Remove"
          onCancel={() => setPendingLine(null)}
          onConfirm={() => {
            editLines(
              pendingLine.key,
              lineRef.current[pendingLine.key].filter((line) => line.id !== pendingLine.id),
            )
            setPendingLine(null)
          }}
        />
      )}
    </div>
  )
}

function StatText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <p className="stat-line">
      <span className="stat-label">{label}</span>{" "}
      <input aria-label={label} value={value} placeholder="—" onChange={(event) => onChange(event.target.value)} />
    </p>
  )
}

function ScoreCell({ label, score, onCommit }: { label: string; score: number; onCommit: (score: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="stat-score">
      <span>{label}</span>
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft ?? String(score)}
        onChange={(event) => {
          const next = event.target.value
          if (!/^\d{0,2}$/.test(next)) return
          setDraft(next)
          if (/^\d+$/.test(next)) onCommit(Number(next))
        }}
        onBlur={() => setDraft(null)}
      />
      <small>{abilityModifier(score)}</small>
    </label>
  )
}

function scalarFields(sheet: MonsterSheet): Scalars {
  return {
    size: sheet.size,
    creatureType: sheet.creatureType,
    alignment: sheet.alignment,
    armorClass: sheet.armorClass,
    hitPoints: sheet.hitPoints,
    speed: sheet.speed,
    savingThrows: sheet.savingThrows,
    skills: sheet.skills,
    damageVulnerabilities: sheet.damageVulnerabilities,
    damageResistances: sheet.damageResistances,
    damageImmunities: sheet.damageImmunities,
    conditionImmunities: sheet.conditionImmunities,
    senses: sheet.senses,
    languages: sheet.languages,
    challenge: sheet.challenge,
    source: sheet.source,
  }
}

function lineFields(sheet: MonsterSheet): Record<LineKey, StatLine[]> {
  return {
    traits: sheet.traits,
    actions: sheet.actions,
    bonusActions: sheet.bonusActions,
    reactions: sheet.reactions,
    legendaryActions: sheet.legendaryActions,
  }
}
