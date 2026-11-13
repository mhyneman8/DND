import { useState } from "react"
import { nextCampaignColor } from "../lib/colors.ts"
import { SECTIONS, sectionById } from "../lib/sections.ts"
import { formatWhen, messageOf, recentEntries } from "../lib/text.ts"
import type { Campaign, RichDoc } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { AfflictionMark } from "./AfflictionMark.tsx"
import { ColorSwatches } from "./ColorSwatches.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, primaryClass } from "./styles.ts"

export function HomeView() {
  const { campaign, campaignsLoaded } = useApp()

  if (!campaignsLoaded) return <StatusLine label="Opening…" />
  if (!campaign) return <CreateCampaign />
  return <CampaignHome campaign={campaign} />
}

function CampaignHome({ campaign }: { campaign: Campaign }) {
  const { entries, links, storyItems, entriesLoadedFor, selectSection, selectEntry, openEntry } = useApp()
  const ready = entriesLoadedFor === campaign.id
  const campaignEntries = entries.filter((entry) => entry.campaignId === campaign.id)
  const prep = storyItems
    .filter((item) => item.campaignId === campaign.id && item.kind === "arc" && item.showOnHome && !item.resolved)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  const recent = recentEntries(campaignEntries)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10 sm:px-10">
      <header>
        <p className="kicker">Campaign</p>
        <h1 className="mt-3 font-serif text-[clamp(2.6rem,5vw,4.4rem)] leading-none font-medium tracking-tight">
          {campaign.name}
        </h1>
        <div className="mt-5 h-px w-16" style={{ background: "var(--campaign)" }} />
      </header>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.filter((section) => section.id !== "home").map((section) => {
          const count =
            section.id === "story-beats"
              ? storyItems.filter((item) => item.campaignId === campaign.id).length
              : campaignEntries.filter((entry) => entry.section === section.id).length
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => selectSection(section.id)}
              className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-[var(--campaign)] hover:text-cream"
            >
              {section.navLabel}
              <span className="ml-2 text-cream" style={{ color: "var(--campaign)" }}>
                {ready ? count : "–"}
              </span>
            </button>
          )
        })}
      </div>

      <section>
        <h2 className="kicker mb-3">Session prep</h2>
        {!ready ? (
          <p className="text-sm text-faint">Loading arcs…</p>
        ) : prep.length === 0 ? (
          <p className="text-sm text-muted">Flag an arc with Show on Home and it will wait here.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {prep.map((arc) => (
              <li key={arc.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectSection("story-beats")
                    selectEntry(arc.id)
                  }}
                  className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-[var(--campaign)]"
                >
                  <span className="text-base">{arc.name}</span>
                  <span className="shrink-0 text-[10px] tracking-wide text-faint uppercase">Arc</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="kicker mb-3">Campaign notes</h2>
        <CampaignNotes key={campaign.id} campaign={campaign} />
      </section>

      <section>
        <h2 className="kicker mb-3">Recent</h2>
        {!ready ? (
          <p className="text-sm text-faint">Loading entries…</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted">Nothing written yet. Open a section to add the first entry.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {recent.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => openEntry(entry)} className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-[var(--campaign)]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base">{entry.name}</span>
                    <AfflictionMark entryId={entry.id} entries={campaignEntries} links={links} />
                    <span className="shrink-0 text-[10px] tracking-wide text-faint uppercase">
                      {sectionById(entry.section).navLabel}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-faint">{formatWhen(entry.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function CampaignNotes({ campaign }: { campaign: Campaign }) {
  const { updateCampaign } = useApp()
  const queue = useAutosave(500)
  const [initial] = useState(campaign.overview)

  return (
    <RichTextField
      initialContent={initial}
      ariaLabel="Campaign notes"
      placeholder="What the table needs to remember."
      minHeight={180}
      onChange={(overview: RichDoc) => {
        queue(() => {
          void updateCampaign(campaign.id, { overview })
        })
      }}
    />
  )
}

function CreateCampaign() {
  const { campaigns, createCampaign } = useApp()
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(() => nextCampaignColor(campaigns.map((campaign) => campaign.color)))
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16"
      onSubmit={(event) => {
        event.preventDefault()
        const next = name.trim()
        if (!next) return
        void createCampaign(next, color).catch((caught: unknown) => setError(messageOf(caught)))
      }}
    >
      <p className="kicker">DM Table</p>
      <h1 className="mt-3 font-serif text-5xl leading-none font-medium">Start a campaign.</h1>
      <p className="mt-4 text-sm text-muted">Campaigns are the tabs along the top. Give this one a name and a color.</p>
      <input
        autoFocus
        value={name}
        aria-label="Campaign name"
        placeholder="Against the salt"
        className={`${fieldClass} mt-6`}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="mt-4">
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button type="submit" className={`${primaryClass} mt-4 self-start`} disabled={!name.trim()}>
        Create campaign
      </button>
    </form>
  )
}

function StatusLine({ label }: { label: string }) {
  return (
    <div className="grid min-h-full place-items-center px-6">
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}
