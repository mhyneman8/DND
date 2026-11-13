import { useState } from "react"
import { cx } from "../lib/cx.ts"
import { compareNames, formatSessionDate, messageOf } from "../lib/text.ts"
import type { PlotSubsection, RichDoc, StoryItem } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, primaryClass } from "./styles.ts"

function todayInput() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function StoryBeats() {
  const { campaign, activeEntryId, entriesLoadedFor, storyItems } = useApp()
  const ready = entriesLoadedFor === campaign?.id
  const selected = storyItems.find((item) => item.id === activeEntryId && item.campaignId === campaign?.id)

  if (!ready) return <p className="text-sm text-muted">Opening the plot…</p>
  if (selected) return <StoryEditor key={selected.id} item={selected} />
  return <PlotBoard />
}

function PlotBoard() {
  const { campaign, plotSubsections, createPlotSubsection } = useApp()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const subsections = plotSubsections
    .filter((item) => item.campaignId === campaign?.id)
    .sort((a, b) => compareNames(a.name, b.name))

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          setError(null)
          void createPlotSubsection(next)
            .then(() => setName(""))
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label="New subsection"
          placeholder="New subsection"
          className={fieldClass}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={primaryClass} disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      {subsections.length === 0 ? (
        <p className="text-sm text-muted">Add a subsection for a plot thread. Sessions and pending arcs live inside it.</p>
      ) : (
        subsections.map((subsection) => <SubsectionCard key={subsection.id} subsection={subsection} />)
      )}
    </div>
  )
}

function SubsectionCard({ subsection }: { subsection: PlotSubsection }) {
  const { storyItems, updatePlotSubsection, deletePlotSubsection, createStoryItem, updateStoryItem, selectEntry } = useApp()
  const [name, setName] = useState(subsection.name)
  const [sessionDate, setSessionDate] = useState(todayInput)
  const [sessionName, setSessionName] = useState("")
  const [arcName, setArcName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const queue = useAutosave(500)
  const items = storyItems.filter((item) => item.subsectionId === subsection.id)
  const sessions = items.filter((item) => item.kind === "session").sort(compareSessions)
  const pending = items.filter((item) => item.kind === "arc" && !item.resolved).sort((a, b) => compareNames(a.name, b.name))
  const resolved = items.filter((item) => item.kind === "arc" && item.resolved).sort((a, b) => compareNames(a.name, b.name))

  function commitName(value: string) {
    const next = value.trim()
    if (!next || next === subsection.name) {
      setName(subsection.name)
      return
    }
    setName(next)
    void updatePlotSubsection(subsection.id, { name: next })
  }

  async function addSession() {
    const date = sessionDate || todayInput()
    const title = sessionName.trim() || formatSessionDate(date)
    setError(null)
    try {
      const item = await createStoryItem({ subsectionId: subsection.id, kind: "session", name: title, sessionDate: date })
      setSessionName("")
      selectEntry(item.id)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  async function addArc() {
    const title = arcName.trim()
    if (!title) return
    setError(null)
    try {
      const item = await createStoryItem({ subsectionId: subsection.id, kind: "arc", name: title, sessionDate: null })
      setArcName("")
      selectEntry(item.id)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  return (
    <section className="rounded-xl border border-line bg-black/15 p-3">
      <div className="flex items-start gap-2">
        <input
          value={name}
          aria-label="Subsection name"
          className="min-w-0 flex-1 bg-transparent font-serif text-xl text-cream outline-none"
          onChange={(event) => setName(event.target.value)}
          onBlur={(event) => commitName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitName(event.currentTarget.value)
              event.currentTarget.blur()
            }
          }}
        />
        <button type="button" className="shrink-0 text-xs text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Delete
        </button>
      </div>
      <div className="mt-2">
        <RichTextField
          key={subsection.id}
          initialContent={subsection.description}
          ariaLabel={`${subsection.name} description`}
          placeholder="What this thread is about."
          minHeight={88}
          onChange={(description: RichDoc) => {
            queue(() => {
              void updatePlotSubsection(subsection.id, { description })
            })
          }}
        />
      </div>

      <div className="mt-4">
        <h3 className="kicker mb-2">Sessions</h3>
        <form
          className="mb-2 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void addSession()
          }}
        >
          <div className="flex gap-2">
            <input
              type="date"
              value={sessionDate}
              aria-label="Session date"
              className={`${fieldClass} w-36 shrink-0`}
              onChange={(event) => setSessionDate(event.target.value)}
            />
            <input
              value={sessionName}
              aria-label="Session title"
              placeholder="Session title"
              className={fieldClass}
              onChange={(event) => setSessionName(event.target.value)}
            />
          </div>
          <button type="submit" className="self-start text-sm text-muted hover:text-cream">
            Add session
          </button>
        </form>
        {sessions.length === 0 ? (
          <p className="text-sm text-faint">No sessions yet.</p>
        ) : (
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <button type="button" onClick={() => selectEntry(session.id)} className="flex w-full items-baseline gap-3 rounded-md px-1 py-1.5 text-left text-sm hover:bg-white/5">
                  <span className="shrink-0 text-[10px] tracking-wide text-faint uppercase">
                    {session.sessionDate ? formatSessionDate(session.sessionDate) : "Undated"}
                  </span>
                  <span className="truncate">{session.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="kicker mb-2">Pending arcs</h3>
        <form
          className="mb-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void addArc()
          }}
        >
          <input
            value={arcName}
            aria-label="Arc name"
            placeholder="Unresolved arc"
            className={fieldClass}
            onChange={(event) => setArcName(event.target.value)}
          />
          <button type="submit" className="shrink-0 text-sm text-muted hover:text-cream" disabled={!arcName.trim()}>
            Add
          </button>
        </form>
        {pending.length === 0 ? (
          <p className="text-sm text-faint">Nothing pending.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((arc) => (
              <ArcRow key={arc.id} arc={arc} onOpen={() => selectEntry(arc.id)} onUpdate={updateStoryItem} />
            ))}
          </ul>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="mt-4">
          <h3 className="kicker mb-2">Resolved</h3>
          <ul className="flex flex-col gap-1">
            {resolved.map((arc) => (
              <li key={arc.id} className="flex items-center justify-between gap-2 px-1 py-1">
                <button type="button" onClick={() => selectEntry(arc.id)} className="min-w-0 truncate text-left text-sm text-muted hover:text-cream">
                  {arc.name}
                </button>
                <button type="button" className="shrink-0 text-xs text-faint hover:text-cream" onClick={() => void updateStoryItem(arc.id, { resolved: false })}>
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title={`Delete ${subsection.name}?`}
          message="This removes the subsection, its sessions, and its arcs."
          confirmLabel="Delete subsection"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void deletePlotSubsection(subsection.id)
          }}
        />
      )}
    </section>
  )
}

function ArcRow({
  arc,
  onOpen,
  onUpdate,
}: {
  arc: StoryItem
  onOpen: () => void
  onUpdate: (id: string, patch: { resolved?: boolean; showOnHome?: boolean }) => Promise<void>
}) {
  return (
    <li className="rounded-lg border border-line px-2 py-2">
      <button type="button" onClick={onOpen} className="w-full truncate text-left text-sm hover:text-[var(--campaign)]">
        {arc.name}
      </button>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <button type="button" className="text-xs text-muted hover:text-cream" onClick={() => void onUpdate(arc.id, { resolved: true, showOnHome: false })}>
          Mark resolved
        </button>
        <button
          type="button"
          aria-pressed={arc.showOnHome}
          className={cx("text-xs", arc.showOnHome ? "text-[var(--campaign)]" : "text-muted hover:text-cream")}
          onClick={() => void onUpdate(arc.id, { showOnHome: !arc.showOnHome })}
        >
          Show on Home
        </button>
      </div>
    </li>
  )
}

function StoryEditor({ item }: { item: StoryItem }) {
  const { updateStoryItem, deleteStoryItem, uploadImage, deleteStoredImage } = useApp()
  const [name, setName] = useState(item.name)
  const [confirming, setConfirming] = useState(false)
  const queue = useAutosave(400)

  function save(next?: { name?: string; body?: RichDoc; sessionDate?: string | null }) {
    queue(() => {
      const trimmed = (next?.name ?? name).trim()
      if (!trimmed) return
      void updateStoryItem(item.id, {
        name: trimmed,
        body: next?.body,
        sessionDate: next?.sessionDate,
      })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="kicker">{item.kind === "session" ? "Session" : item.resolved ? "Resolved arc" : "Pending arc"}</p>
      <input
        value={name}
        aria-label={item.kind === "session" ? "Session title" : "Arc name"}
        className={`${fieldClass} font-serif text-xl`}
        onChange={(event) => {
          setName(event.target.value)
          save({ name: event.target.value })
        }}
      />
      {item.kind === "session" && (
        <input
          type="date"
          value={item.sessionDate ?? ""}
          aria-label="Session date"
          className={`${fieldClass} w-40`}
          onChange={(event) => {
            if (!event.target.value) return
            void updateStoryItem(item.id, { sessionDate: event.target.value })
          }}
        />
      )}
      {item.kind === "arc" && (
        <div className="flex flex-wrap gap-2">
          {item.resolved ? (
            <button type="button" className="text-sm text-muted hover:text-cream" onClick={() => void updateStoryItem(item.id, { resolved: false })}>
              Reopen
            </button>
          ) : (
            <button
              type="button"
              className="text-sm text-muted hover:text-cream"
              onClick={() => void updateStoryItem(item.id, { resolved: true, showOnHome: false })}
            >
              Mark resolved
            </button>
          )}
          <button
            type="button"
            aria-pressed={item.showOnHome}
            className={cx("text-sm", item.showOnHome ? "text-[var(--campaign)]" : "text-muted hover:text-cream")}
            onClick={() => void updateStoryItem(item.id, { showOnHome: !item.showOnHome })}
          >
            Show on Home
          </button>
        </div>
      )}
      <ImageUpload
        path={item.imagePath}
        alt={name || "Story image"}
        onUpload={async (file) => {
          const path = await uploadImage(file)
          const previous = item.imagePath
          await updateStoryItem(item.id, { imagePath: path })
          if (previous && previous !== path) await deleteStoredImage(previous)
        }}
        onRemove={async () => {
          const previous = item.imagePath
          await updateStoryItem(item.id, { imagePath: null })
          if (previous) await deleteStoredImage(previous)
        }}
      />
      <RichTextField
        initialContent={item.body}
        ariaLabel={item.kind === "session" ? "Session notes" : "Arc notes"}
        placeholder={item.kind === "session" ? "What happened." : "What's still in motion."}
        minHeight={160}
        onChange={(body) => save({ body })}
      />
      <div className="border-t border-line pt-3">
        <button type="button" className="text-sm text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Delete {item.kind === "session" ? "session" : "arc"}
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${item.name}?`}
          message={item.kind === "session" ? "This session note will be removed." : "This arc will be removed."}
          confirmLabel={item.kind === "session" ? "Delete session" : "Delete arc"}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void deleteStoryItem(item.id)
          }}
        />
      )}
    </div>
  )
}

function compareSessions(a: StoryItem, b: StoryItem) {
  const dateA = a.sessionDate ?? ""
  const dateB = b.sessionDate ?? ""
  if (dateA !== dateB) return dateB.localeCompare(dateA)
  return b.createdAt.localeCompare(a.createdAt)
}
