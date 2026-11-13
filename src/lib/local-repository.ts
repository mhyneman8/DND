import { idbDelete, idbGet, idbSet } from "./idb.ts"
import { extensionFor, readDataUrl, validateImage } from "./images.ts"
import { now, uid } from "./ids.ts"
import { DataError, type CreateEntryInput, type CreateLinkInput, type CreateListItemInput, type CreateStoryItemInput, type Repository, type SignUpResult } from "./repository.ts"
import { normalizeNpcSheet, npcSheetFromEntry } from "./npc.ts"
import { normalizePcSheet, pcSheetFromEntry } from "./pc.ts"
import { asDoc, emptyDoc } from "./text.ts"
import type { Campaign, CampaignPatch, Entry, EntryLink, EntryPatch, ListItem, NpcSheet, NpcSheetPatch, PcPerson, PcSheet, PcSheetPatch, PlotSubsection, PlotSubsectionPatch, StoryItem, StoryItemPatch } from "./types.ts"

const STORAGE_KEY = "dm-table:v1"

type StoredCampaign = Campaign & { worldId?: string }

type LocalDb = {
  campaigns: Campaign[]
  entries: Entry[]
  listItems: ListItem[]
  links: EntryLink[]
  plotSubsections: PlotSubsection[]
  storyItems: StoryItem[]
  pcSheets: PcSheet[]
  npcSheets: NpcSheet[]
}

function alliancePeople(items: ListItem[], entryId: string): PcPerson[] {
  return items
    .filter((item) => item.entryId === entryId && item.listKey === "alliances")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => ({ id: item.id, label: item.label }))
}

function emptyDb(): LocalDb {
  return { campaigns: [], entries: [], listItems: [], links: [], plotSubsections: [], storyItems: [], pcSheets: [], npcSheets: [] }
}

function adoptLegacyStoryBeats(db: LocalDb) {
  const legacy = db.entries.filter((entry) => entry.section === "story-beats")
  if (legacy.length === 0) return false
  for (const entry of legacy) {
    const name = entry.subsection.trim() || "Plot"
    let subsection = db.plotSubsections.find((item) => item.campaignId === entry.campaignId && item.name === name)
    if (!subsection) {
      subsection = {
        id: uid(),
        campaignId: entry.campaignId,
        name,
        description: emptyDoc(),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }
      db.plotSubsections.push(subsection)
    }
    db.storyItems.push({
      id: entry.id,
      campaignId: entry.campaignId,
      subsectionId: subsection.id,
      kind: "arc",
      name: entry.name,
      sessionDate: null,
      body: asDoc(entry.body),
      resolved: false,
      showOnHome: false,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })
  }
  const ids = new Set(legacy.map((entry) => entry.id))
  db.entries = db.entries.filter((entry) => !ids.has(entry.id))
  db.listItems = db.listItems.filter((item) => !ids.has(item.entryId))
  db.links = db.links.filter((link) => !ids.has(link.sourceEntryId) && !ids.has(link.targetEntryId))
  return true
}

function loadDb(): { db: LocalDb; migrated: boolean } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { db: emptyDb(), migrated: false }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalDb> & { worlds?: unknown[]; campaigns?: StoredCampaign[] }
    const storedCampaigns = (parsed.campaigns ?? []) as StoredCampaign[]
    const migrated = (parsed.worlds?.length ?? 0) > 0 || storedCampaigns.some((campaign) => campaign.worldId !== undefined)
    return {
      migrated,
      db: {
        campaigns: storedCampaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          color: campaign.color,
          overview: asDoc(campaign.overview),
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        })),
        entries: (parsed.entries ?? []).map((entry) => ({ ...entry, body: asDoc(entry.body) })),
        listItems: parsed.listItems ?? [],
        links: parsed.links ?? [],
        plotSubsections: (parsed.plotSubsections ?? []).map((item) => ({ ...item, description: asDoc(item.description) })),
        storyItems: (parsed.storyItems ?? []).map((item) => ({
          ...item,
          body: asDoc(item.body),
          sessionDate: item.sessionDate ?? null,
          resolved: item.resolved ?? false,
          showOnHome: item.showOnHome ?? false,
        })),
        pcSheets: (parsed.pcSheets ?? []).flatMap((sheet) => {
          const normalized = normalizePcSheet(sheet)
          return normalized ? [normalized] : []
        }),
        npcSheets: (parsed.npcSheets ?? []).flatMap((sheet) => {
          const normalized = normalizeNpcSheet(sheet)
          return normalized ? [normalized] : []
        }),
      },
    }
  } catch {
    return { db: emptyDb(), migrated: false }
  }
}

export class LocalRepository implements Repository {
  readonly mode = "local" as const
  private db: LocalDb

  constructor() {
    const loaded = loadDb()
    this.db = loaded.db
    if (loaded.migrated || adoptLegacyStoryBeats(this.db)) this.commit()
  }

  private commit() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db))
    } catch {
      throw new DataError("This browser is out of space for campaign notes.")
    }
  }

  onAuthChange(listener: (session: { email: string } | null) => void) {
    listener(null)
    return () => {}
  }

  signIn(_email: string, _password: string): Promise<void> {
    return Promise.reject(new DataError("This copy is stored on this device only."))
  }

  signUp(_email: string, _password: string): Promise<SignUpResult> {
    return Promise.reject(new DataError("This copy is stored on this device only."))
  }

  async signOut() {}

  async listCampaigns() {
    return this.db.campaigns
      .map((campaign) => ({ ...campaign, overview: asDoc(campaign.overview) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createCampaign(name: string, color: string) {
    const timestamp = now()
    const campaign: Campaign = {
      id: uid(),
      name: name.trim(),
      color,
      overview: asDoc(null),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.db.campaigns.push(campaign)
    this.commit()
    return { ...campaign, overview: asDoc(campaign.overview) }
  }

  async updateCampaign(id: string, patch: CampaignPatch) {
    const campaign = this.db.campaigns.find((item) => item.id === id)
    if (!campaign) throw new DataError("That campaign is gone.")
    if (patch.name !== undefined) campaign.name = patch.name.trim()
    if (patch.color !== undefined) campaign.color = patch.color
    if (patch.overview !== undefined) campaign.overview = patch.overview
    campaign.updatedAt = now()
    this.commit()
  }

  async deleteCampaign(id: string) {
    const entryIds = new Set(this.db.entries.filter((entry) => entry.campaignId === id).map((entry) => entry.id))
    const paths = this.db.entries.filter((entry) => entry.campaignId === id && entry.imagePath).map((entry) => entry.imagePath as string)
    this.db.campaigns = this.db.campaigns.filter((campaign) => campaign.id !== id)
    this.db.entries = this.db.entries.filter((entry) => entry.campaignId !== id)
    this.db.listItems = this.db.listItems.filter((item) => !entryIds.has(item.entryId))
    this.db.links = this.db.links.filter((link) => link.campaignId !== id)
    this.db.plotSubsections = this.db.plotSubsections.filter((item) => item.campaignId !== id)
    this.db.storyItems = this.db.storyItems.filter((item) => item.campaignId !== id)
    this.db.pcSheets = this.db.pcSheets.filter((item) => item.campaignId !== id)
    this.db.npcSheets = this.db.npcSheets.filter((item) => item.campaignId !== id)
    this.commit()
    await Promise.all(paths.map((path) => idbDelete(path).catch(() => undefined)))
  }

  async listEntries(campaignId: string) {
    return this.db.entries
      .filter((entry) => entry.campaignId === campaignId)
      .map((entry) => ({ ...entry, body: asDoc(entry.body) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createEntry(input: CreateEntryInput) {
    const timestamp = now()
    const entry: Entry = {
      id: uid(),
      campaignId: input.campaignId,
      section: input.section,
      subsection: input.subsection.trim(),
      name: input.name.trim(),
      body: input.body,
      imagePath: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.db.entries.push(entry)
    this.commit()
    return { ...entry }
  }

  async updateEntry(id: string, patch: EntryPatch) {
    const entry = this.db.entries.find((item) => item.id === id)
    if (!entry) throw new DataError("That entry is gone.")
    if (patch.name !== undefined) entry.name = patch.name.trim()
    if (patch.subsection !== undefined) entry.subsection = patch.subsection.trim()
    if (patch.body !== undefined) entry.body = patch.body
    if (patch.imagePath !== undefined) entry.imagePath = patch.imagePath
    entry.updatedAt = now()
    this.commit()
  }

  async deleteEntry(id: string) {
    const entry = this.db.entries.find((item) => item.id === id)
    this.db.entries = this.db.entries.filter((item) => item.id !== id)
    this.db.listItems = this.db.listItems.filter((item) => item.entryId !== id)
    this.db.listItems = this.db.listItems.map((item) =>
      item.linkedEntryId === id ? { ...item, linkedEntryId: null } : item,
    )
    this.db.links = this.db.links.filter((link) => link.sourceEntryId !== id && link.targetEntryId !== id)
    this.db.pcSheets = this.db.pcSheets.filter((sheet) => sheet.entryId !== id)
    this.db.npcSheets = this.db.npcSheets.filter((sheet) => sheet.entryId !== id)
    this.commit()
    if (entry?.imagePath) await idbDelete(entry.imagePath).catch(() => undefined)
  }

  async listItems(entryId: string) {
    return this.db.listItems
      .filter((item) => item.entryId === entryId)
      .map((item) => ({ ...item }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createItem(input: CreateListItemInput) {
    const item: ListItem = {
      id: uid(),
      entryId: input.entryId,
      listKey: input.listKey,
      label: input.label.trim(),
      linkedEntryId: input.linkedEntryId,
      createdAt: now(),
    }
    this.db.listItems.push(item)
    this.commit()
    return { ...item }
  }

  async updateItem(id: string, patch: { label?: string; linkedEntryId?: string | null }) {
    const item = this.db.listItems.find((candidate) => candidate.id === id)
    if (!item) throw new DataError("That list item is gone.")
    if (patch.label !== undefined) item.label = patch.label.trim()
    if (patch.linkedEntryId !== undefined) item.linkedEntryId = patch.linkedEntryId
    this.commit()
  }

  async deleteItem(id: string) {
    this.db.listItems = this.db.listItems.filter((item) => item.id !== id)
    this.commit()
  }

  async listLinks(campaignId: string) {
    return this.db.links
      .filter((link) => link.campaignId === campaignId)
      .map((link) => ({ ...link }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createLink(input: CreateLinkInput) {
    const exists = this.db.links.some(
      (link) =>
        (link.sourceEntryId === input.sourceEntryId && link.targetEntryId === input.targetEntryId) ||
        (link.sourceEntryId === input.targetEntryId && link.targetEntryId === input.sourceEntryId),
    )
    if (exists) throw new DataError("Those entries are already linked.")
    const link: EntryLink = {
      id: uid(),
      campaignId: input.campaignId,
      sourceEntryId: input.sourceEntryId,
      targetEntryId: input.targetEntryId,
      createdAt: now(),
    }
    this.db.links.push(link)
    this.commit()
    return { ...link }
  }

  async deleteLink(id: string) {
    this.db.links = this.db.links.filter((link) => link.id !== id)
    this.commit()
  }

  async listPlotSubsections(campaignId: string) {
    return this.db.plotSubsections
      .filter((item) => item.campaignId === campaignId)
      .map((item) => ({ ...item, description: asDoc(item.description) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createPlotSubsection(campaignId: string, name: string) {
    const timestamp = now()
    const subsection: PlotSubsection = {
      id: uid(),
      campaignId,
      name: name.trim(),
      description: emptyDoc(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.db.plotSubsections.push(subsection)
    this.commit()
    return { ...subsection, description: asDoc(subsection.description) }
  }

  async updatePlotSubsection(id: string, patch: PlotSubsectionPatch) {
    const subsection = this.db.plotSubsections.find((item) => item.id === id)
    if (!subsection) throw new DataError("That subsection is gone.")
    if (patch.name !== undefined) subsection.name = patch.name.trim()
    if (patch.description !== undefined) subsection.description = patch.description
    subsection.updatedAt = now()
    this.commit()
  }

  async deletePlotSubsection(id: string) {
    this.db.plotSubsections = this.db.plotSubsections.filter((item) => item.id !== id)
    this.db.storyItems = this.db.storyItems.filter((item) => item.subsectionId !== id)
    this.commit()
  }

  async listStoryItems(campaignId: string) {
    return this.db.storyItems
      .filter((item) => item.campaignId === campaignId)
      .map((item) => ({ ...item, body: asDoc(item.body) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async createStoryItem(input: CreateStoryItemInput) {
    const timestamp = now()
    const item: StoryItem = {
      id: uid(),
      campaignId: input.campaignId,
      subsectionId: input.subsectionId,
      kind: input.kind,
      name: input.name.trim(),
      sessionDate: input.sessionDate,
      body: emptyDoc(),
      resolved: false,
      showOnHome: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.db.storyItems.push(item)
    this.commit()
    return { ...item, body: asDoc(item.body) }
  }

  async updateStoryItem(id: string, patch: StoryItemPatch) {
    const item = this.db.storyItems.find((entry) => entry.id === id)
    if (!item) throw new DataError("That story item is gone.")
    if (patch.name !== undefined) item.name = patch.name.trim()
    if (patch.sessionDate !== undefined) item.sessionDate = patch.sessionDate
    if (patch.body !== undefined) item.body = patch.body
    if (patch.resolved !== undefined) item.resolved = patch.resolved
    if (patch.showOnHome !== undefined) item.showOnHome = patch.showOnHome
    item.updatedAt = now()
    this.commit()
  }

  async deleteStoryItem(id: string) {
    this.db.storyItems = this.db.storyItems.filter((item) => item.id !== id)
    this.commit()
  }

  async listPcSheets(campaignId: string) {
    let changed = false
    const characters = this.db.entries.filter((entry) => entry.campaignId === campaignId && entry.section === "pcs")
    for (const entry of characters) {
      if (this.db.pcSheets.some((sheet) => sheet.entryId === entry.id)) continue
      this.db.pcSheets.push(pcSheetFromEntry(entry, alliancePeople(this.db.listItems, entry.id), entry.updatedAt))
      changed = true
    }
    if (changed) this.commit()
    return this.db.pcSheets
      .filter((sheet) => sheet.campaignId === campaignId)
      .flatMap((sheet) => {
        const normalized = normalizePcSheet(sheet)
        return normalized ? [normalized] : []
      })
  }

  async createPcSheet(entryId: string) {
    const existing = this.db.pcSheets.find((sheet) => sheet.entryId === entryId)
    if (existing) {
      const normalized = normalizePcSheet(existing)
      if (normalized) return normalized
    }
    const entry = this.db.entries.find((item) => item.id === entryId)
    if (!entry) throw new DataError("That character is gone.")
    const sheet = pcSheetFromEntry(entry, alliancePeople(this.db.listItems, entry.id), now())
    this.db.pcSheets.push(sheet)
    this.commit()
    return normalizePcSheet(sheet) ?? sheet
  }

  async updatePcSheet(entryId: string, patch: PcSheetPatch) {
    const sheet = this.db.pcSheets.find((item) => item.entryId === entryId)
    if (!sheet) throw new DataError("That character sheet is gone.")
    if (patch.className !== undefined) sheet.className = patch.className
    if (patch.subclass !== undefined) sheet.subclass = patch.subclass
    if (patch.sheetUrl !== undefined) sheet.sheetUrl = patch.sheetUrl
    if (patch.bio !== undefined) sheet.bio = patch.bio
    if (patch.subclassNotes !== undefined) sheet.subclassNotes = patch.subclassNotes
    if (patch.people !== undefined) sheet.people = patch.people.map((person) => ({ ...person }))
    if (patch.events !== undefined) sheet.events = patch.events.map((event) => ({ ...event }))
    if (patch.objectives !== undefined) sheet.objectives = patch.objectives.map((item) => ({ ...item }))
    sheet.updatedAt = now()
    const entry = this.db.entries.find((item) => item.id === entryId)
    if (entry) entry.updatedAt = sheet.updatedAt
    this.commit()
  }

  async listNpcSheets(campaignId: string) {
    let changed = false
    const characters = this.db.entries.filter((entry) => entry.campaignId === campaignId && entry.section === "npcs")
    for (const entry of characters) {
      if (this.db.npcSheets.some((sheet) => sheet.entryId === entry.id)) continue
      this.db.npcSheets.push(npcSheetFromEntry(entry, alliancePeople(this.db.listItems, entry.id), entry.updatedAt))
      changed = true
    }
    if (changed) this.commit()
    return this.db.npcSheets
      .filter((sheet) => sheet.campaignId === campaignId)
      .flatMap((sheet) => {
        const normalized = normalizeNpcSheet(sheet)
        return normalized ? [normalized] : []
      })
  }

  async createNpcSheet(entryId: string) {
    const existing = this.db.npcSheets.find((sheet) => sheet.entryId === entryId)
    if (existing) {
      const normalized = normalizeNpcSheet(existing)
      if (normalized) return normalized
    }
    const entry = this.db.entries.find((item) => item.id === entryId)
    if (!entry) throw new DataError("That character is gone.")
    const sheet = npcSheetFromEntry(entry, alliancePeople(this.db.listItems, entry.id), now())
    this.db.npcSheets.push(sheet)
    this.commit()
    return normalizeNpcSheet(sheet) ?? sheet
  }

  async updateNpcSheet(entryId: string, patch: NpcSheetPatch) {
    const sheet = this.db.npcSheets.find((item) => item.entryId === entryId)
    if (!sheet) throw new DataError("That character sheet is gone.")
    if (patch.description !== undefined) sheet.description = patch.description
    if (patch.motivations !== undefined) sheet.motivations = patch.motivations
    if (patch.affinity !== undefined) sheet.affinity = patch.affinity
    if (patch.hostileAt !== undefined) sheet.hostileAt = patch.hostileAt
    if (patch.friendlyAt !== undefined) sheet.friendlyAt = patch.friendlyAt
    if (patch.people !== undefined) sheet.people = patch.people.map((person) => ({ ...person }))
    sheet.updatedAt = now()
    const entry = this.db.entries.find((item) => item.id === entryId)
    if (entry) entry.updatedAt = sheet.updatedAt
    this.commit()
  }

  async uploadImage(campaignId: string, file: File) {
    validateImage(file)
    const path = `local/${campaignId}/${uid()}.${extensionFor(file)}`
    await idbSet(path, await readDataUrl(file))
    return path
  }

  async imageUrl(path: string) {
    return idbGet(path)
  }

  async deleteImage(path: string) {
    await idbDelete(path)
  }
}
