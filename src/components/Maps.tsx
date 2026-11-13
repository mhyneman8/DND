import { Minus, Plus } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { imageFileFromClipboard, imageFileFromTransfer } from "../lib/images.ts"
import { compareNames, messageOf } from "../lib/text.ts"
import type { Entry, RichDoc } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { usePasteImage } from "../lib/usePasteImage.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass, iconButtonClass, primaryClass } from "./styles.ts"

const MIN_SCALE = 1
const MAX_SCALE = 8

type Point = { x: number; y: number }
type View = { scale: number; x: number; y: number }

export function Maps() {
  const { campaign, activeEntryId, entries, entriesLoadedFor } = useApp()
  const ready = entriesLoadedFor === campaign?.id
  const map = entries.find(
    (entry) => entry.id === activeEntryId && entry.section === "maps" && entry.campaignId === campaign?.id,
  )

  if (!ready) return <p className="text-sm text-muted">Opening maps…</p>
  if (map) return <MapEditor key={map.id} entry={map} />
  return <MapList />
}

function MapList() {
  const { entries, campaign, createEntry, selectEntry } = useApp()
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const maps = entries
    .filter((entry) => entry.campaignId === campaign?.id && entry.section === "maps")
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => compareNames(a.name, b.name))
  const hasMaps = entries.some((entry) => entry.campaignId === campaign?.id && entry.section === "maps")

  return (
    <div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) {
            setError("Give the map a name.")
            return
          }
          setError(null)
          void createEntry({ section: "maps", name: next, subsection: "" })
            .then((entry) => {
              setName("")
              selectEntry(entry.id)
            })
            .catch((caught: unknown) => setError(messageOf(caught)))
        }}
      >
        <input
          value={name}
          aria-label="Map name"
          placeholder="Map name"
          className={fieldClass}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={primaryClass} disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {hasMaps && (
        <input
          value={query}
          aria-label="Search maps"
          placeholder="Search"
          className={`${fieldClass} mb-4`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {maps.length === 0 ? (
        <p className="text-sm text-muted">
          {query.trim() ? "No maps with that name." : "Name a map, then add the picture. You can zoom and pan once it is open."}
        </p>
      ) : (
        <ul>
          {maps.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => selectEntry(entry.id)}
                className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
              >
                <span className="truncate">{entry.name}</span>
                {entry.subsection.trim() && <span className="truncate text-xs text-faint">{entry.subsection}</span>}
                {!entry.imagePath && <span className="ml-auto shrink-0 text-xs text-faint">No picture</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MapEditor({ entry }: { entry: Entry }) {
  const { updateEntry, deleteEntry, uploadImage, deleteStoredImage, imageUrl } = useApp()
  const [name, setName] = useState(entry.name)
  const [confirming, setConfirming] = useState(false)
  const [picture, setPicture] = useState<{ path: string; url: string | null } | null>(null)
  const queue = useAutosave(400)
  const nameRef = useRef(name)
  const bodyRef = useRef(entry.body)
  function saveDraft(next?: { name?: string; body?: RichDoc }) {
    if (next?.name !== undefined) nameRef.current = next.name
    if (next?.body !== undefined) bodyRef.current = next.body
    queue(() => {
      const trimmed = nameRef.current.trim()
      if (!trimmed) return
      void updateEntry(entry.id, { name: trimmed, body: bodyRef.current })
    })
  }

  useEffect(() => {
    if (!entry.imagePath) return
    let cancelled = false
    const path = entry.imagePath
    void imageUrl(path).then((next) => {
      if (!cancelled) setPicture({ path, url: next })
    })
    return () => {
      cancelled = true
    }
  }, [entry.imagePath, imageUrl])

  const pictureUrl = entry.imagePath && picture?.path === entry.imagePath ? picture.url : null
  const pictureReady = !entry.imagePath || picture?.path === entry.imagePath

  async function storeFile(file: File) {
    const path = await uploadImage(file)
    const previous = entry.imagePath
    await updateEntry(entry.id, { imagePath: path })
    if (previous && previous !== path) await deleteStoredImage(previous)
  }

  async function clearImage() {
    const previous = entry.imagePath
    await updateEntry(entry.id, { imagePath: null })
    if (previous) await deleteStoredImage(previous)
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={name}
        aria-label="Map name"
        className={`${fieldClass} font-serif text-xl`}
        onChange={(event) => {
          setName(event.target.value)
          saveDraft({ name: event.target.value })
        }}
      />
      {pictureUrl ? (
        <MapStage key={entry.imagePath} url={pictureUrl} alt={name || "Map"} onUpload={storeFile} onRemove={clearImage} />
      ) : entry.imagePath && !pictureReady ? (
        <p className="text-sm text-muted">Opening map…</p>
      ) : (
        <ImageUpload tall path={null} alt={name || "Map"} onUpload={storeFile} onRemove={clearImage} />
      )}
      <RichTextField
        initialContent={entry.body}
        ariaLabel="Map notes"
        placeholder="What this map is for."
        minHeight={96}
        onChange={(body: RichDoc) => saveDraft({ body })}
      />
      <div className="border-t border-line pt-3">
        <button type="button" className="text-sm text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Delete map
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Delete this map?"
          message={`“${entry.name}” and its picture will be removed.`}
          confirmLabel="Delete map"
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

function MapStage({
  url,
  alt,
  onUpload,
  onRemove,
}: {
  url: string
  alt: string
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 })
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [draggingFile, setDraggingFile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ kind: "pan" | "pinch"; start: View; origin: Point; distance: number; mid: Point } | null>(null)

  function commit(next: View) {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale))
    const settled = scale <= 1.001 ? { scale: 1, x: 0, y: 0 } : { scale, x: next.x, y: next.y }
    viewRef.current = settled
    setView(settled)
  }

  function zoomAt(clientX: number, clientY: number, nextScale: number) {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    const current = viewRef.current
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
    const px = clientX - rect.left - rect.width / 2
    const py = clientY - rect.top - rect.height / 2
    const ratio = scale / current.scale
    commit({
      scale,
      x: px - (px - current.x) * ratio,
      y: py - (py - current.y) * ratio,
    })
  }

  const zoomAtRef = useRef(zoomAt)
  useEffect(() => {
    zoomAtRef.current = zoomAt
  }, [zoomAt])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const raw = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const factor = Math.exp(-raw * 0.0016)
      zoomAtRef.current(event.clientX, event.clientY, viewRef.current.scale * factor)
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  async function take(file: File | null | undefined) {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      await onUpload(file)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  usePasteImage((file) => {
    void take(file)
  })

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return
    const target = event.target
    if (target instanceof Element && target.closest("button, input, a")) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture can fail if the pointer already ended. The gesture still tracks the move.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    if (points.length >= 2) {
      const [a, b] = points
      gesture.current = {
        kind: "pinch",
        start: viewRef.current,
        origin: midpoint(a, b),
        distance: Math.max(distance(a, b), 1),
        mid: midpoint(a, b),
      }
      return
    }
    gesture.current = {
      kind: "pan",
      start: viewRef.current,
      origin: points[0],
      distance: 0,
      mid: points[0],
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    const active = gesture.current
    if (active.kind === "pan" && points.length === 1 && active.start.scale > 1) {
      commit({
        scale: active.start.scale,
        x: active.start.x + (points[0].x - active.origin.x),
        y: active.start.y + (points[0].y - active.origin.y),
      })
      return
    }
    if (active.kind === "pinch" && points.length >= 2) {
      const frame = frameRef.current
      if (!frame) return
      const [a, b] = points
      const rect = frame.getBoundingClientRect()
      const mid = midpoint(a, b)
      const scale = active.start.scale * (Math.max(distance(a, b), 1) / active.distance)
      const px = active.mid.x - rect.left - rect.width / 2
      const py = active.mid.y - rect.top - rect.height / 2
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
      const ratio = clamped / active.start.scale
      commit({
        scale: clamped,
        x: px - (px - active.start.x) * ratio + (mid.x - active.mid.x),
        y: py - (py - active.start.y) * ratio + (mid.y - active.mid.y),
      })
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    const points = [...pointers.current.values()]
    if (points.length === 0) {
      gesture.current = null
      return
    }
    gesture.current = {
      kind: "pan",
      start: viewRef.current,
      origin: points[0],
      distance: 0,
      mid: points[0],
    }
  }

  return (
    <div>
      <div
        ref={frameRef}
        tabIndex={0}
        role="application"
        aria-label={`${alt}, map viewer`}
        className={`map-stage relative h-[min(62vh,36rem)] min-h-72 touch-none overflow-hidden rounded-lg border border-line bg-black/40 outline-none select-none focus:border-[var(--campaign)] ${view.scale > 1 ? "cursor-grab active:cursor-grabbing" : ""} ${draggingFile ? "border-[var(--campaign)]" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          const next = viewRef.current.scale > 1.05 ? 1 : 2
          zoomAt(event.clientX, event.clientY, next)
        }}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault()
            const frame = frameRef.current
            if (!frame) return
            const rect = frame.getBoundingClientRect()
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, viewRef.current.scale * 1.2)
          }
          if (event.key === "-" || event.key === "_") {
            event.preventDefault()
            const frame = frameRef.current
            if (!frame) return
            const rect = frame.getBoundingClientRect()
            zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, viewRef.current.scale / 1.2)
          }
          if (event.key === "0") {
            event.preventDefault()
            commit({ scale: 1, x: 0, y: 0 })
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDraggingFile(true)
        }}
        onDragLeave={() => setDraggingFile(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDraggingFile(false)
          void take(imageFileFromTransfer(event.dataTransfer))
        }}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          className="pointer-events-none absolute top-1/2 left-1/2 max-h-full max-w-full select-none"
          style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.scale})` }}
        />
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg border border-line bg-ink/85 p-1">
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Zoom out"
            disabled={view.scale <= 1}
            onClick={() => {
              const frame = frameRef.current
              if (!frame) return
              const rect = frame.getBoundingClientRect()
              zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.scale / 1.25)
            }}
          >
            <Minus size={14} />
          </button>
          <span className="w-12 text-center text-xs text-muted">{Math.round(view.scale * 100)}%</span>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Zoom in"
            disabled={view.scale >= MAX_SCALE}
            onClick={() => {
              const frame = frameRef.current
              if (!frame) return
              const rect = frame.getBoundingClientRect()
              zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.scale * 1.25)
            }}
          >
            <Plus size={14} />
          </button>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-muted hover:text-cream" onClick={() => commit({ scale: 1, x: 0, y: 0 })}>
            Fit
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-2 left-2 text-[10px] tracking-wide text-faint uppercase">
          Scroll to zoom. Drag to pan.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" className="text-sm text-muted hover:text-cream" disabled={busy} onClick={() => fileRef.current?.click()}>
          Replace picture
        </button>
        <button
          type="button"
          className="text-sm text-muted hover:text-cream"
          disabled={busy}
          onClick={() => {
            setError(null)
            void imageFileFromClipboard()
              .then((file) => {
                if (!file) {
                  setError("Copy a picture or screenshot first.")
                  return
                }
                return take(file)
              })
              .catch((caught: unknown) => setError(messageOf(caught)))
          }}
        >
          Paste screenshot
        </button>
        <button type="button" className="text-sm text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Remove picture
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            void take(event.target.files?.[0])
            event.target.value = ""
          }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title="Remove this picture?"
          message="The map name and notes stay."
          confirmLabel="Remove picture"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            setError(null)
            void onRemove().catch((caught: unknown) => setError(messageOf(caught)))
          }}
        />
      )}
    </div>
  )
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
