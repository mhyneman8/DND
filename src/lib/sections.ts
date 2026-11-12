import {
  Gem,
  HeartPulse,
  House,
  Map,
  MapPin,
  ScrollText,
  Skull,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { PanelSectionId, SectionId } from "./types.ts"

export type SectionDef = {
  id: SectionId
  label: string
  navLabel: string
  icon: LucideIcon
}

export const SECTIONS: SectionDef[] = [
  { id: "home", label: "Home", navLabel: "Home", icon: House },
  { id: "story-beats", label: "Story Beats", navLabel: "Story Beats", icon: ScrollText },
  { id: "pcs", label: "PCs", navLabel: "PCs", icon: Users },
  { id: "npcs", label: "NPCs", navLabel: "NPCs", icon: UserRound },
  { id: "monsters", label: "Monsters", navLabel: "Monsters", icon: Skull },
  { id: "afflictions", label: "Afflictions", navLabel: "Afflictions", icon: HeartPulse },
  { id: "locations", label: "Locations", navLabel: "Locations", icon: MapPin },
  { id: "maps", label: "Maps", navLabel: "Maps", icon: Map },
  { id: "misc", label: "Misc / Magic Items", navLabel: "Magic Items", icon: Gem },
]

export function sectionById(id: SectionId) {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0]
}

export function isSectionId(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

export function listMeta(section: PanelSectionId) {
  switch (section) {
    case "pcs":
    case "npcs":
      return { key: "alliances", title: "Alliances", placeholder: "Add an alliance" }
    case "locations":
      return { key: "factions", title: "Factions", placeholder: "Add a faction" }
    case "monsters":
      return { key: "groups", title: "Groups", placeholder: "Add a group" }
    case "afflictions":
      return { key: "carriers", title: "Carriers", placeholder: "Add a carrier" }
    case "story-beats":
      return { key: "involved", title: "Involved", placeholder: "Add someone involved" }
    case "maps":
      return { key: "markers", title: "Markers", placeholder: "Add a marker" }
    case "misc":
      return { key: "owners", title: "Owners", placeholder: "Add an owner" }
  }
}

export function notesPlaceholder(section: PanelSectionId) {
  switch (section) {
    case "story-beats":
      return "What changes if this beat lands?"
    case "pcs":
      return "How they show up at the table."
    case "npcs":
      return "What they want, and what they hide."
    case "monsters":
      return "How it fights, flees, or bargains."
    case "afflictions":
      return "How it takes hold, and how it ends."
    case "locations":
      return "What a visitor notices first."
    case "maps":
      return "What this map is for."
    case "misc":
      return "What it does, and who has it."
  }
}
