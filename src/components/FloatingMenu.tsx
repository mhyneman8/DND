import { type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"

export function placeMenu(anchor: HTMLElement, width: number, align: "left" | "right"): CSSProperties {
  const rect = anchor.getBoundingClientRect()
  const preferred = align === "left" ? rect.left : rect.right - width
  return {
    position: "fixed",
    top: rect.bottom + 8,
    left: Math.max(8, Math.min(preferred, window.innerWidth - width - 8)),
    width,
    zIndex: 50,
  }
}

export function placePopover(anchor: HTMLElement, width: number, height: number): CSSProperties {
  const rect = anchor.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const openUp = spaceBelow < height && rect.top > spaceBelow
  const top = openUp ? Math.max(8, rect.top - height - 8) : rect.bottom + 8
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  return {
    position: "fixed",
    top,
    left,
    width,
    zIndex: 60,
  }
}

export function FloatingMenu({ menuId, style, children }: { menuId: string; style: CSSProperties; children: ReactNode }) {
  return createPortal(
    <div data-dismiss-for={menuId} style={style}>
      {children}
    </div>,
    document.body,
  )
}
