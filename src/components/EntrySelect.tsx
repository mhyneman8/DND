import { Link2 } from "lucide-react"
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { cx } from "../lib/cx.ts"
import { sectionById } from "../lib/sections.ts"
import { compareNames } from "../lib/text.ts"
import type { Entry } from "../lib/types.ts"
import { useDismiss } from "../lib/useDismiss.ts"
import { FloatingMenu, placePopover } from "./FloatingMenu.tsx"

export function EntrySelect({
  entries,
  excludeIds,
  label,
  onSelect,
}: {
  entries: Entry[]
  excludeIds: string[]
  label: string
  onSelect: (entryId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden", zIndex: 60 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { ref, menuId } = useDismiss(open, () => setOpen(false))
  const excluded = new Set(excludeIds)
  const matches = entries
    .filter((entry) => !excluded.has(entry.id) && entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => compareNames(a.name, b.name))
    .slice(0, 8)
  const highlighted = Math.min(activeIndex, Math.max(matches.length - 1, 0))

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return
    const width = Math.min(256, window.innerWidth - 16)
    setMenuStyle(placePopover(buttonRef.current, width, menuRef.current.offsetHeight))
  }, [open, matches.length, query])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-cream"
        aria-expanded={open}
        onClick={() => {
          setQuery("")
          setActiveIndex(0)
          setOpen((current) => !current)
        }}
      >
        <Link2 size={13} />
        {label}
      </button>
      {open && (
        <FloatingMenu menuId={menuId} style={menuStyle}>
        <div ref={menuRef} role="menu" className="w-64 rounded-xl border border-line bg-raised p-2 shadow-[0_16px_40px_rgb(0_0_0/0.35)]">
          <input
            autoFocus
            value={query}
            onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
            placeholder="Search entries"
            aria-label="Search entries to link"
            className="mb-1 w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-cream outline-none placeholder:text-faint"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)))
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              } else if (event.key === "Enter" && matches[highlighted]) {
                event.preventDefault()
                onSelect(matches[highlighted].id)
                setQuery("")
                setOpen(false)
              }
            }}
          />
          {matches.length === 0 ? (
            <p className="px-2 py-2 text-sm text-faint">Nothing to link.</p>
          ) : (
            <ul>
              {matches.map((entry, index) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={cx(
                      "flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
                      index === highlighted ? "bg-white/10 text-cream" : "text-cream hover:bg-white/5",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onSelect(entry.id)
                      setQuery("")
                      setOpen(false)
                    }}
                  >
                    <span className="truncate">{entry.name}</span>
                    <span className="shrink-0 text-[10px] tracking-wide text-faint uppercase">
                      {sectionById(entry.section).navLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </FloatingMenu>
      )}
    </div>
  )
}
