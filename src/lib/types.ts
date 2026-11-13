import type { JSONContent } from "@tiptap/core"

export type RichDoc = JSONContent

export type Campaign = {
  id: string
  name: string
  color: string
  overview: RichDoc
  createdAt: string
  updatedAt: string
}

export type CampaignPatch = Partial<Pick<Campaign, "name" | "color" | "overview">>

export type PanelSectionId =
  | "story-beats"
  | "pcs"
  | "npcs"
  | "monsters"
  | "afflictions"
  | "locations"
  | "maps"
  | "misc"

export type SectionId = "home" | PanelSectionId

export type Entry = {
  id: string
  campaignId: string
  section: PanelSectionId
  subsection: string
  name: string
  body: RichDoc
  imagePath: string | null
  createdAt: string
  updatedAt: string
}

export type EntryPatch = Partial<Pick<Entry, "name" | "subsection" | "body" | "imagePath">>

export type ListItem = {
  id: string
  entryId: string
  listKey: string
  label: string
  linkedEntryId: string | null
  createdAt: string
}

export type EntryLink = {
  id: string
  campaignId: string
  sourceEntryId: string
  targetEntryId: string
  createdAt: string
}

export type PlotSubsection = {
  id: string
  campaignId: string
  name: string
  description: RichDoc
  createdAt: string
  updatedAt: string
}

export type PlotSubsectionPatch = Partial<Pick<PlotSubsection, "name" | "description">>

export type StoryKind = "session" | "arc"

export type StoryItem = {
  id: string
  campaignId: string
  subsectionId: string
  kind: StoryKind
  name: string
  sessionDate: string | null
  body: RichDoc
  resolved: boolean
  showOnHome: boolean
  createdAt: string
  updatedAt: string
}

export type StoryItemPatch = Partial<Pick<StoryItem, "name" | "sessionDate" | "body" | "resolved" | "showOnHome">>

export type PcPerson = {
  id: string
  label: string
}

export type PcEvent = {
  id: string
  sessionTag: string
  text: string
  createdAt: string
}

export type PcObjective = {
  id: string
  label: string
}

export type PcSheet = {
  entryId: string
  campaignId: string
  className: string
  subclass: string
  sheetUrl: string
  bio: RichDoc
  subclassNotes: RichDoc
  people: PcPerson[]
  events: PcEvent[]
  objectives: PcObjective[]
  updatedAt: string
}

export type PcSheetPatch = Partial<
  Pick<PcSheet, "className" | "subclass" | "sheetUrl" | "bio" | "subclassNotes" | "people" | "events" | "objectives">
>

export type AffinityTone = "hostile" | "neutral" | "friendly"

export type NpcSheet = {
  entryId: string
  campaignId: string
  description: RichDoc
  motivations: RichDoc
  affinity: number
  hostileAt: number
  friendlyAt: number
  people: PcPerson[]
  updatedAt: string
}

export type NpcSheetPatch = Partial<
  Pick<NpcSheet, "description" | "motivations" | "affinity" | "hostileAt" | "friendlyAt" | "people">
>

export type CatalogKind = "affliction" | "location" | "item"

export type CatalogSheet = {
  entryId: string
  campaignId: string
  kind: CatalogKind
  savingThrow: string
  damage: string
  place: string
  effect: string
  notes: RichDoc
  updatedAt: string
}

export type CatalogSheetPatch = Partial<Pick<CatalogSheet, "savingThrow" | "damage" | "place" | "effect" | "notes">>
