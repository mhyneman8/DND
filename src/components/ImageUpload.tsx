import { ImagePlus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { messageOf } from "../lib/text.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"

export function ImageUpload({
  path,
  alt,
  onUpload,
  onRemove,
}: {
  path: string | null
  alt: string
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const { imageUrl } = useApp()
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const url = path && resolved?.path === path ? resolved.url : null

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const imagePath = path
    void imageUrl(imagePath).then((next) => {
      if (!cancelled) setResolved({ path: imagePath, url: next })
    })
    return () => {
      cancelled = true
    }
  }, [imageUrl, path])

  async function take(file: File | undefined) {
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

  return (
    <div>
      {url ? (
        <div className="relative">
          <img src={url} alt={alt} className="max-h-48 w-full rounded-lg border border-line object-contain" />
          <button
            type="button"
            aria-label="Remove image"
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md bg-ink/80 text-cream"
            onClick={() => setConfirming(true)}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted ${dragging ? "border-[var(--campaign)] bg-white/5" : "border-line"}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void take(event.dataTransfer.files[0])
          }}
        >
          <ImagePlus size={18} />
          <span>{busy ? "Uploading…" : "Add an image"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              void take(event.target.files?.[0])
              event.target.value = ""
            }}
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title="Remove this image?"
          message="The picture is deleted. The entry stays."
          confirmLabel="Remove image"
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
