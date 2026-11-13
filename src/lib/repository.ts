import type {
  Campaign,
  CampaignPatch,
  Entry,
  EntryLink,
  EntryPatch,
  ListItem,
  PanelSectionId,
  PlotSubsection,
  PlotSubsectionPatch,
  RichDoc,
  CatalogSheet,
  CatalogSheetPatch,
  MonsterSheet,
  MonsterSheetPatch,
  NpcSheet,
  NpcSheetPatch,
  PcSheet,
  PcSheetPatch,
  StickyNote,
  StickyNotePatch,
  StoryItem,
  StoryItemPatch,
  StoryKind,
} from "./types.ts"

export class DataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DataError"
  }
}

export type SessionUser = { email: string }

export type SignUpResult = { needsConfirmation: boolean }

export type CreateEntryInput = {
  campaignId: string
  section: PanelSectionId
  name: string
  subsection: string
  body: RichDoc
}

export type CreateListItemInput = {
  entryId: string
  listKey: string
  label: string
  linkedEntryId: string | null
}

export type CreateLinkInput = {
  campaignId: string
  sourceEntryId: string
  targetEntryId: string
}

export type CreateStoryItemInput = {
  campaignId: string
  subsectionId: string
  kind: StoryKind
  name: string
  sessionDate: string | null
}

export interface Repository {
  readonly mode: "local" | "supabase"
  onAuthChange(listener: (session: SessionUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<SignUpResult>
  signOut(): Promise<void>
  listCampaigns(): Promise<Campaign[]>
  createCampaign(name: string, color: string): Promise<Campaign>
  updateCampaign(id: string, patch: CampaignPatch): Promise<void>
  deleteCampaign(id: string): Promise<void>
  listEntries(campaignId: string): Promise<Entry[]>
  createEntry(input: CreateEntryInput): Promise<Entry>
  updateEntry(id: string, patch: EntryPatch): Promise<void>
  deleteEntry(id: string): Promise<void>
  listItems(entryId: string): Promise<ListItem[]>
  createItem(input: CreateListItemInput): Promise<ListItem>
  updateItem(id: string, patch: { label?: string; linkedEntryId?: string | null }): Promise<void>
  deleteItem(id: string): Promise<void>
  listLinks(campaignId: string): Promise<EntryLink[]>
  createLink(input: CreateLinkInput): Promise<EntryLink>
  deleteLink(id: string): Promise<void>
  listPlotSubsections(campaignId: string): Promise<PlotSubsection[]>
  createPlotSubsection(campaignId: string, name: string): Promise<PlotSubsection>
  updatePlotSubsection(id: string, patch: PlotSubsectionPatch): Promise<void>
  deletePlotSubsection(id: string): Promise<void>
  listStoryItems(campaignId: string): Promise<StoryItem[]>
  createStoryItem(input: CreateStoryItemInput): Promise<StoryItem>
  updateStoryItem(id: string, patch: StoryItemPatch): Promise<void>
  deleteStoryItem(id: string): Promise<void>
  listPcSheets(campaignId: string): Promise<PcSheet[]>
  createPcSheet(entryId: string): Promise<PcSheet>
  updatePcSheet(entryId: string, patch: PcSheetPatch): Promise<void>
  listNpcSheets(campaignId: string): Promise<NpcSheet[]>
  createNpcSheet(entryId: string): Promise<NpcSheet>
  updateNpcSheet(entryId: string, patch: NpcSheetPatch): Promise<void>
  listCatalogSheets(campaignId: string): Promise<CatalogSheet[]>
  createCatalogSheet(entryId: string): Promise<CatalogSheet>
  updateCatalogSheet(entryId: string, patch: CatalogSheetPatch): Promise<void>
  listMonsterSheets(campaignId: string): Promise<MonsterSheet[]>
  createMonsterSheet(entryId: string): Promise<MonsterSheet>
  updateMonsterSheet(entryId: string, patch: MonsterSheetPatch): Promise<void>
  listStickyNotes(campaignId: string): Promise<StickyNote[]>
  createStickyNote(campaignId: string): Promise<StickyNote>
  updateStickyNote(id: string, patch: StickyNotePatch): Promise<void>
  deleteStickyNote(id: string): Promise<void>
  uploadImage(campaignId: string, file: File): Promise<string>
  imageUrl(path: string): Promise<string | null>
  deleteImage(path: string): Promise<void>
}
