import { ChevronLeft, X } from "lucide-react"
import { useEffect } from "react"
import { sectionById } from "../lib/sections.ts"
import { useApp } from "../state/AppState.tsx"
import { CatalogSection } from "./Catalogs.tsx"
import { EntryEditor } from "./EntryEditor.tsx"
import { EntryList } from "./EntryList.tsx"
import { Npcs } from "./Npcs.tsx"
import { PlayerCharacters } from "./PlayerCharacters.tsx"
import { StoryBeats } from "./StoryBeats.tsx"
import { iconButtonClass } from "./styles.ts"

export function SectionPanel() {
  const { activeSection, activeEntryId, entries, storyItems, campaign, selectSection, selectEntry } = useApp()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.closest("[data-escape-lock]") || target.closest(".ProseMirror") || target.closest("[role='menu']")) return
      }
      if (activeEntryId) selectEntry(null)
      else selectSection("home")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeEntryId, selectEntry, selectSection])

  if (activeSection === "home") return null
  const section = sectionById(activeSection)
  const entry = entries.find(
    (item) => item.id === activeEntryId && item.section === activeSection && item.campaignId === campaign?.id,
  )
  const storyOpen =
    activeSection === "story-beats" && storyItems.some((item) => item.id === activeEntryId && item.campaignId === campaign?.id)

  const sheetOpen = (activeSection === "pcs" || activeSection === "npcs") && Boolean(entry)

  return (
    <section className={sheetOpen ? "panel panel-wide" : "panel"} aria-label={section.label}>
      <header className="flex items-center gap-1 border-b border-line px-2 py-2">
        {entry || storyOpen ? (
          <button type="button" className={iconButtonClass} aria-label={`Back to ${section.label}`} onClick={() => selectEntry(null)}>
            <ChevronLeft size={18} />
          </button>
        ) : (
          <span className="size-8" />
        )}
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg">{section.label}</h2>
        <button type="button" className={iconButtonClass} aria-label="Close panel" onClick={() => selectSection("home")}>
          <X size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!campaign ? (
          <p className="text-sm text-muted">Choose a campaign to start writing.</p>
        ) : activeSection === "story-beats" ? (
          <StoryBeats />
        ) : activeSection === "pcs" ? (
          <PlayerCharacters />
        ) : activeSection === "npcs" ? (
          <Npcs />
        ) : activeSection === "afflictions" || activeSection === "locations" || activeSection === "misc" ? (
          <CatalogSection section={activeSection} />
        ) : entry ? (
          <EntryEditor entry={entry} />
        ) : (
          <EntryList section={activeSection} />
        )}
      </div>
    </section>
  )
}
