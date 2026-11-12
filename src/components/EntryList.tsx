import { useState } from "react"
import { compareNames, groupEntries, messageOf } from "../lib/text.ts"
import type { PanelSectionId } from "../lib/types.ts"
import { useApp } from "../state/AppState.tsx"
import { fieldClass, primaryClass } from "./styles.ts"

export function EntryList({ section }: { section: PanelSectionId }) {
  const { entries, campaign, createEntry, selectEntry } = useApp()
  const [query, setQuery] = useState("")
  const [name, setName] = useState("")
  const [subsection, setSubsection] = useState("")
  const [error, setError] = useState<string | null>(null)
  const campaignEntries = entries.filter((entry) => entry.campaignId === campaign?.id)
  const groups = groupEntries(campaignEntries, section, query)
  const showHeadings = groups.length > 1 || groups.some((group) => group.label !== "General")
  const subsections = [...new Set(campaignEntries.filter((entry) => entry.section === section && entry.subsection.trim()).map((entry) => entry.subsection.trim()))].sort(compareNames)
  const listId = `${section}-subsections`

  return (
    <div>
      <form
        className="mb-4 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) {
            setError("Give it a name.")
            return
          }
          setError(null)
          void createEntry({ section, name: next, subsection })
            .then((entry) => {
              setName("")
              setSubsection("")
              selectEntry(entry.id)
            })
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label="Entry name"
          placeholder="Name"
          className={fieldClass}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex gap-2">
          <input
            value={subsection}
            aria-label="Subsection"
            placeholder="Subsection"
            list={listId}
            className={fieldClass}
            onChange={(event) => setSubsection(event.target.value)}
          />
          <button type="submit" className={primaryClass} disabled={!name.trim()}>
            Add
          </button>
        </div>
        <datalist id={listId}>
          {subsections.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </form>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {campaignEntries.some((entry) => entry.section === section) && (
        <input
          value={query}
          aria-label="Search entries"
          placeholder="Search"
          className={`${fieldClass} mb-4`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted">
          {query.trim()
            ? "No entries with that name."
            : "Nothing here yet. New entries sort themselves alphabetically inside each subsection."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.key}>
              {showHeadings && <h3 className="kicker mb-1">{group.label}</h3>}
              <ul>
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => selectEntry(entry.id)}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    >
                      <span className="truncate">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
