import { cx } from "../lib/cx.ts"
import { SECTIONS } from "../lib/sections.ts"
import { useApp } from "../state/AppState.tsx"

export function Sidebar() {
  const { activeSection, selectSection } = useApp()

  return (
    <nav aria-label="Sections" className="flex w-[5.6rem] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line px-1.5 py-2">
      {SECTIONS.map((section) => {
        const active = section.id === activeSection
        const Icon = section.icon
        return (
          <button
            key={section.id}
            type="button"
            aria-current={active ? "page" : undefined}
            title={section.label}
            onClick={() => selectSection(section.id)}
            className={cx(
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] leading-tight",
              active ? "bg-white/10 text-cream" : "text-muted hover:bg-white/5 hover:text-cream",
            )}
            style={active ? { boxShadow: "inset 2px 0 0 var(--campaign)" } : undefined}
          >
            <Icon size={18} strokeWidth={1.75} color={active ? "var(--campaign)" : "currentColor"} />
            <span>{section.navLabel}</span>
          </button>
        )
      })}
    </nav>
  )
}
