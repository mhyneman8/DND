import { useEffect, useRef } from "react"
import { imageFileFromTransfer } from "./images.ts"

export function usePasteImage(onFile: (file: File) => void, enabled = true) {
  const onFileRef = useRef(onFile)

  useEffect(() => {
    onFileRef.current = onFile
  }, [onFile])

  useEffect(() => {
    if (!enabled) return
    function onPaste(event: ClipboardEvent) {
      const file = imageFileFromTransfer(event.clipboardData)
      if (!file) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const typing = target.closest("input, textarea, select, [contenteditable='true'], .ProseMirror")
        const text = event.clipboardData?.getData("text/plain") ?? ""
        if (typing && text.length > 0) return
      }
      event.preventDefault()
      onFileRef.current(file)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [enabled])
}
