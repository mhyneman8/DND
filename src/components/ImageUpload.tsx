import { ClipboardPaste, ImagePlus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { imageFileFromClipboard, imageFileFromTransfer } from "../lib/images.ts"
import { messageOf } from "../lib/text.ts"
import { usePasteImage } from "../lib/usePasteImage.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"

export function ImageUpload({
  path,
  alt,
  onUpload,
  onRemove,
  tall = false,
}: {
  path: string | null
  alt: string
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
  tall?: boolean
}) {
  const { imageUrl } = useApp()
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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

  async function pasteClipboard() {
    setError(null)
    try {
      const file = await imageFileFromClipboard()
      if (!file) {
        setError("Copy a picture or screenshot first.")
        return
      }
      await take(file)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }

  return (
    <div
      className={tall ? "flex h-full min-h-72 flex-col" : undefined}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void take(imageFileFromTransfer(event.dataTransfer))
      }}
    >
      {url ? (
        <div className={`relative ${dragging ? "rounded-lg ring-1 ring-[var(--campaign)]" : ""}`}>
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
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted ${tall ? "min-h-72 flex-1 justify-center" : ""} ${dragging ? "border-[var(--campaign)] bg-white/5" : "border-line"}`}
        >
          <ImagePlus size={18} />
          <span>{busy ? "Uploading…" : "Add a picture or screenshot"}</span>
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
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        {url && (
          <button type="button" className="text-sm text-muted hover:text-cream" disabled={busy} onClick={() => fileRef.current?.click()}>
            Replace picture
          </button>
        )}
        <button type="button" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-cream" disabled={busy} onClick={() => void pasteClipboard()}>
          <ClipboardPaste size={14} />
          Paste screenshot
        </button>
      </div>
      {url && (
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
