import { useEffect } from "react"
import { createPortal } from "react-dom"
import { quietClass } from "./styles.ts"

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [onCancel])

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        data-escape-lock=""
        className="w-full max-w-sm rounded-xl border border-line bg-raised p-5 shadow-[0_24px_60px_rgb(0_0_0/0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-serif text-2xl leading-none">
          {title}
        </h2>
        <p className="mt-3 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={quietClass} autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-danger px-3 py-2 text-sm font-medium text-ink hover:opacity-90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
