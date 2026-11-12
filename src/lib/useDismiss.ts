import { useEffect, useId, useRef } from "react"

export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node) || ref.current?.contains(target)) return
      if (target instanceof Element && target.closest(`[data-dismiss-for="${menuId}"]`)) return
      onCloseRef.current()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target
      if (target instanceof HTMLElement && target.closest("[data-escape-lock]")) return
      event.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [menuId, open])

  return { ref, menuId }
}
