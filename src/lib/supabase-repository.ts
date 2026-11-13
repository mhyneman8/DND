import type { SupabaseClient } from "@supabase/supabase-js"
import { extensionFor, validateImage } from "./images.ts"
import { DataError, type CreateEntryInput, type CreateLinkInput, type CreateListItemInput, type CreateStoryItemInput, type Repository } from "./repository.ts"
import { catalogSheetFromEntry, normalizeCatalogSheet } from "./catalog.ts"
import { monsterSheetFromEntry, normalizeMonsterSheet } from "./monster.ts"
import { npcSheetFromEntry, normalizeNpcSheet } from "./npc.ts"
import { asPcEvents, asPcObjectives, asPcPeople, pcSheetFromEntry } from "./pc.ts"
import { asDoc } from "./text.ts"
import type { Campaign, CampaignPatch, CatalogSheet, CatalogSheetPatch, Entry, EntryLink, EntryPatch, ListItem, MonsterSheet, MonsterSheetPatch, NpcSheet, NpcSheetPatch, PanelSectionId, PcSheet, PcSheetPatch, PlotSubsection, PlotSubsectionPatch, StickyNote, StickyNotePatch, StoryItem, StoryItemPatch, StoryKind } from "./types.ts"

const BUCKET = "campaign-media"

type CampaignRow = {
  id: string
  name: string
  color: string
  overview: unknown
  created_at: string
  updated_at: string
}
type EntryRow = {
  id: string
  campaign_id: string
  section: PanelSectionId
  subsection: string
  name: string
  body: unknown
  image_path: string | null
  created_at: string
  updated_at: string
}
type ListItemRow = {
  id: string
  entry_id: string
  list_key: string
  label: string
  linked_entry_id: string | null
  created_at: string
}
type LinkRow = {
  id: string
  campaign_id: string
  source_entry_id: string
  target_entry_id: string
  created_at: string
}
type PlotSubsectionRow = {
  id: string
  campaign_id: string
  name: string
  description: unknown
  created_at: string
  updated_at: string
}
type StoryItemRow = {
  id: string
  campaign_id: string
  subsection_id: string
  kind: StoryKind
  name: string
  session_date: string | null
  body: unknown
  image_path: string | null
  resolved: boolean
  show_on_home: boolean
  created_at: string
  updated_at: string
}

const STORY_COLUMNS =
  "id, campaign_id, subsection_id, kind, name, session_date, body, resolved, show_on_home, image_path, created_at, updated_at"

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    overview: asDoc(row.overview),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    section: row.section,
    subsection: row.subsection,
    name: row.name,
    body: asDoc(row.body),
    imagePath: row.image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapItem(row: ListItemRow): ListItem {
  return {
    id: row.id,
    entryId: row.entry_id,
    listKey: row.list_key,
    label: row.label,
    linkedEntryId: row.linked_entry_id,
    createdAt: row.created_at,
  }
}

function mapPlotSubsection(row: PlotSubsectionRow): PlotSubsection {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: asDoc(row.description),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapStoryItem(row: StoryItemRow): StoryItem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    subsectionId: row.subsection_id,
    kind: row.kind,
    name: row.name,
    sessionDate: row.session_date,
    body: asDoc(row.body),
    imagePath: row.image_path,
    resolved: row.resolved,
    showOnHome: row.show_on_home,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type StickyNoteRow = {
  id: string
  campaign_id: string
  body: string
  character_id: string | null
  created_at: string
  updated_at: string
}

function mapStickyNote(row: StickyNoteRow): StickyNote {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    body: row.body ?? "",
    characterId: row.character_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const PC_COLUMNS =
  "entry_id, campaign_id, class_name, subclass, sheet_url, bio, subclass_notes, people, events, objectives, updated_at"

type PcSheetRow = {
  entry_id: string
  campaign_id: string
  class_name: string
  subclass: string
  sheet_url: string
  bio: unknown
  subclass_notes: unknown
  people: unknown
  events: unknown
  objectives: unknown
  updated_at: string
}

type AllianceRow = {
  id: string
  entry_id: string
  list_key: string
  label: string
  created_at: string
}

function mapPcSheet(row: PcSheetRow): PcSheet {
  return {
    entryId: row.entry_id,
    campaignId: row.campaign_id,
    className: row.class_name ?? "",
    subclass: row.subclass ?? "",
    sheetUrl: row.sheet_url ?? "",
    bio: asDoc(row.bio),
    subclassNotes: asDoc(row.subclass_notes),
    people: asPcPeople(row.people),
    events: asPcEvents(row.events),
    objectives: asPcObjectives(row.objectives),
    updatedAt: row.updated_at,
  }
}

const NPC_COLUMNS =
  "entry_id, campaign_id, description, motivations, affinity, hostile_at, friendly_at, people, updated_at"

type NpcSheetRow = {
  entry_id: string
  campaign_id: string
  description: unknown
  motivations: unknown
  affinity: number
  hostile_at: number
  friendly_at: number
  people: unknown
  updated_at: string
}

function mapNpcSheet(row: NpcSheetRow): NpcSheet {
  const sheet = normalizeNpcSheet({
    entryId: row.entry_id,
    campaignId: row.campaign_id,
    description: row.description,
    motivations: row.motivations,
    affinity: row.affinity,
    hostileAt: row.hostile_at,
    friendlyAt: row.friendly_at,
    people: row.people,
    updatedAt: row.updated_at,
  })
  if (!sheet) throw new DataError("That character sheet is unreadable.")
  return sheet
}

const CATALOG_COLUMNS = "entry_id, campaign_id, kind, saving_throw, damage, place, effect, notes, updated_at"

type CatalogSheetRow = {
  entry_id: string
  campaign_id: string
  kind: string
  saving_throw: string
  damage: string
  place: string
  effect: string
  notes: unknown
  updated_at: string
}

function mapCatalogSheet(row: CatalogSheetRow): CatalogSheet {
  const sheet = normalizeCatalogSheet({
    entryId: row.entry_id,
    campaignId: row.campaign_id,
    kind: row.kind,
    savingThrow: row.saving_throw,
    damage: row.damage,
    place: row.place,
    effect: row.effect,
    notes: row.notes,
    updatedAt: row.updated_at,
  })
  if (!sheet) throw new DataError("That sheet is unreadable.")
  return sheet
}

function catalogInsert(sheet: CatalogSheet) {
  return {
    entry_id: sheet.entryId,
    campaign_id: sheet.campaignId,
    kind: sheet.kind,
    saving_throw: sheet.savingThrow,
    damage: sheet.damage,
    place: sheet.place,
    effect: sheet.effect,
    notes: sheet.notes,
  }
}

const MONSTER_COLUMNS =
  "entry_id, campaign_id, size, creature_type, alignment, armor_class, hit_points, speed, abilities, saving_throws, skills, damage_vulnerabilities, damage_resistances, damage_immunities, condition_immunities, senses, languages, challenge, traits, actions, bonus_actions, reactions, legendary_actions, notes, source, updated_at"

type MonsterSheetRow = {
  entry_id: string
  campaign_id: string
  size: string
  creature_type: string
  alignment: string
  armor_class: string
  hit_points: string
  speed: string
  abilities: unknown
  saving_throws: string
  skills: string
  damage_vulnerabilities: string
  damage_resistances: string
  damage_immunities: string
  condition_immunities: string
  senses: string
  languages: string
  challenge: string
  traits: unknown
  actions: unknown
  bonus_actions: unknown
  reactions: unknown
  legendary_actions: unknown
  notes: unknown
  source: string
  updated_at: string
}

function mapMonsterSheet(row: MonsterSheetRow): MonsterSheet {
  const sheet = normalizeMonsterSheet({
    entryId: row.entry_id,
    campaignId: row.campaign_id,
    size: row.size,
    creatureType: row.creature_type,
    alignment: row.alignment,
    armorClass: row.armor_class,
    hitPoints: row.hit_points,
    speed: row.speed,
    abilities: row.abilities,
    savingThrows: row.saving_throws,
    skills: row.skills,
    damageVulnerabilities: row.damage_vulnerabilities,
    damageResistances: row.damage_resistances,
    damageImmunities: row.damage_immunities,
    conditionImmunities: row.condition_immunities,
    senses: row.senses,
    languages: row.languages,
    challenge: row.challenge,
    traits: row.traits,
    actions: row.actions,
    bonusActions: row.bonus_actions,
    reactions: row.reactions,
    legendaryActions: row.legendary_actions,
    notes: row.notes,
    source: row.source,
    updatedAt: row.updated_at,
  })
  if (!sheet) throw new DataError("That stat block is unreadable.")
  return sheet
}

function monsterInsert(sheet: MonsterSheet) {
  return {
    entry_id: sheet.entryId,
    campaign_id: sheet.campaignId,
    size: sheet.size,
    creature_type: sheet.creatureType,
    alignment: sheet.alignment,
    armor_class: sheet.armorClass,
    hit_points: sheet.hitPoints,
    speed: sheet.speed,
    abilities: sheet.abilities,
    saving_throws: sheet.savingThrows,
    skills: sheet.skills,
    damage_vulnerabilities: sheet.damageVulnerabilities,
    damage_resistances: sheet.damageResistances,
    damage_immunities: sheet.damageImmunities,
    condition_immunities: sheet.conditionImmunities,
    senses: sheet.senses,
    languages: sheet.languages,
    challenge: sheet.challenge,
    traits: sheet.traits,
    actions: sheet.actions,
    bonus_actions: sheet.bonusActions,
    reactions: sheet.reactions,
    legendary_actions: sheet.legendaryActions,
    notes: sheet.notes,
    source: sheet.source,
  }
}

function monsterPatch(patch: MonsterSheetPatch) {
  const row: Record<string, unknown> = {}
  if (patch.size !== undefined) row.size = patch.size
  if (patch.creatureType !== undefined) row.creature_type = patch.creatureType
  if (patch.alignment !== undefined) row.alignment = patch.alignment
  if (patch.armorClass !== undefined) row.armor_class = patch.armorClass
  if (patch.hitPoints !== undefined) row.hit_points = patch.hitPoints
  if (patch.speed !== undefined) row.speed = patch.speed
  if (patch.abilities !== undefined) row.abilities = patch.abilities
  if (patch.savingThrows !== undefined) row.saving_throws = patch.savingThrows
  if (patch.skills !== undefined) row.skills = patch.skills
  if (patch.damageVulnerabilities !== undefined) row.damage_vulnerabilities = patch.damageVulnerabilities
  if (patch.damageResistances !== undefined) row.damage_resistances = patch.damageResistances
  if (patch.damageImmunities !== undefined) row.damage_immunities = patch.damageImmunities
  if (patch.conditionImmunities !== undefined) row.condition_immunities = patch.conditionImmunities
  if (patch.senses !== undefined) row.senses = patch.senses
  if (patch.languages !== undefined) row.languages = patch.languages
  if (patch.challenge !== undefined) row.challenge = patch.challenge
  if (patch.traits !== undefined) row.traits = patch.traits
  if (patch.actions !== undefined) row.actions = patch.actions
  if (patch.bonusActions !== undefined) row.bonus_actions = patch.bonusActions
  if (patch.reactions !== undefined) row.reactions = patch.reactions
  if (patch.legendaryActions !== undefined) row.legendary_actions = patch.legendaryActions
  if (patch.notes !== undefined) row.notes = patch.notes
  if (patch.source !== undefined) row.source = patch.source
  return row
}

function mapLink(row: LinkRow): EntryLink {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sourceEntryId: row.source_entry_id,
    targetEntryId: row.target_entry_id,
    createdAt: row.created_at,
  }
}

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const
  private urls = new Map<string, { url: string; expires: number }>()
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  private fail(error: { message: string } | null) {
    if (error) throw new DataError(error.message)
  }

  private async requireUserId() {
    const { data, error } = await this.client.auth.getSession()
    this.fail(error)
    const id = data.session?.user.id
    if (!id) throw new DataError("Sign in required.")
    return id
  }

  onAuthChange(listener: (session: { email: string } | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.email ? { email: session.user.email } : null
      queueMicrotask(() => listener(next))
    })
    return () => data.subscription.unsubscribe()
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password })
    this.fail(error)
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password })
    this.fail(error)
    return { needsConfirmation: !data.session }
  }

  async signOut() {
    const { error } = await this.client.auth.signOut()
    this.fail(error)
  }

  async listCampaigns() {
    const { data, error } = await this.client
      .from("campaigns")
      .select("id, name, color, overview, created_at, updated_at")
      .order("created_at", { ascending: true })
    this.fail(error)
    return ((data ?? []) as CampaignRow[]).map(mapCampaign)
  }

  async createCampaign(name: string, color: string) {
    const { data, error } = await this.client
      .from("campaigns")
      .insert({ name: name.trim(), color })
      .select("id, name, color, overview, created_at, updated_at")
      .single()
    this.fail(error)
    return mapCampaign(data as CampaignRow)
  }

  async updateCampaign(id: string, patch: CampaignPatch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.color !== undefined) row.color = patch.color
    if (patch.overview !== undefined) row.overview = patch.overview
    const { error } = await this.client.from("campaigns").update(row).eq("id", id)
    this.fail(error)
  }

  async deleteCampaign(id: string) {
    await this.removeCampaignImages(id)
    const { error } = await this.client.from("campaigns").delete().eq("id", id)
    this.fail(error)
  }

  async listEntries(campaignId: string) {
    const { data, error } = await this.client
      .from("entries")
      .select("id, campaign_id, section, subsection, name, body, image_path, created_at, updated_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
    this.fail(error)
    return ((data ?? []) as EntryRow[]).map(mapEntry)
  }

  async createEntry(input: CreateEntryInput) {
    const { data, error } = await this.client
      .from("entries")
      .insert({
        campaign_id: input.campaignId,
        section: input.section,
        subsection: input.subsection.trim(),
        name: input.name.trim(),
        body: input.body,
      })
      .select("id, campaign_id, section, subsection, name, body, image_path, created_at, updated_at")
      .single()
    this.fail(error)
    return mapEntry(data as EntryRow)
  }

  async updateEntry(id: string, patch: EntryPatch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.subsection !== undefined) row.subsection = patch.subsection.trim()
    if (patch.body !== undefined) row.body = patch.body
    if (patch.imagePath !== undefined) row.image_path = patch.imagePath
    const { error } = await this.client.from("entries").update(row).eq("id", id)
    this.fail(error)
  }

  async deleteEntry(id: string) {
    const { data } = await this.client.from("entries").select("image_path").eq("id", id).maybeSingle()
    const path = (data as { image_path: string | null } | null)?.image_path
    const { error } = await this.client.from("entries").delete().eq("id", id)
    this.fail(error)
    if (path) await this.deleteImage(path)
  }

  async listItems(entryId: string) {
    const { data, error } = await this.client
      .from("list_items")
      .select("id, entry_id, list_key, label, linked_entry_id, created_at")
      .eq("entry_id", entryId)
      .order("created_at", { ascending: true })
    this.fail(error)
    return ((data ?? []) as ListItemRow[]).map(mapItem)
  }

  async createItem(input: CreateListItemInput) {
    const { data, error } = await this.client
      .from("list_items")
      .insert({
        entry_id: input.entryId,
        list_key: input.listKey,
        label: input.label.trim(),
        linked_entry_id: input.linkedEntryId,
      })
      .select("id, entry_id, list_key, label, linked_entry_id, created_at")
      .single()
    this.fail(error)
    return mapItem(data as ListItemRow)
  }

  async updateItem(id: string, patch: { label?: string; linkedEntryId?: string | null }) {
    const row: Record<string, unknown> = {}
    if (patch.label !== undefined) row.label = patch.label.trim()
    if (patch.linkedEntryId !== undefined) row.linked_entry_id = patch.linkedEntryId
    const { error } = await this.client.from("list_items").update(row).eq("id", id)
    this.fail(error)
  }

  async deleteItem(id: string) {
    const { error } = await this.client.from("list_items").delete().eq("id", id)
    this.fail(error)
  }

  async listLinks(campaignId: string) {
    const { data, error } = await this.client
      .from("links")
      .select("id, campaign_id, source_entry_id, target_entry_id, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
    this.fail(error)
    return ((data ?? []) as LinkRow[]).map(mapLink)
  }

  async createLink(input: CreateLinkInput) {
    const { data, error } = await this.client
      .from("links")
      .insert({
        campaign_id: input.campaignId,
        source_entry_id: input.sourceEntryId,
        target_entry_id: input.targetEntryId,
      })
      .select("id, campaign_id, source_entry_id, target_entry_id, created_at")
      .single()
    this.fail(error)
    return mapLink(data as LinkRow)
  }

  async deleteLink(id: string) {
    const { error } = await this.client.from("links").delete().eq("id", id)
    this.fail(error)
  }

  async listPlotSubsections(campaignId: string) {
    const { data, error } = await this.client
      .from("plot_subsections")
      .select("id, campaign_id, name, description, created_at, updated_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
    this.fail(error)
    return ((data ?? []) as PlotSubsectionRow[]).map(mapPlotSubsection)
  }

  async createPlotSubsection(campaignId: string, name: string) {
    const { data, error } = await this.client
      .from("plot_subsections")
      .insert({ campaign_id: campaignId, name: name.trim() })
      .select("id, campaign_id, name, description, created_at, updated_at")
      .single()
    this.fail(error)
    return mapPlotSubsection(data as PlotSubsectionRow)
  }

  async updatePlotSubsection(id: string, patch: PlotSubsectionPatch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.description !== undefined) row.description = patch.description
    const { error } = await this.client.from("plot_subsections").update(row).eq("id", id)
    this.fail(error)
  }

  async deletePlotSubsection(id: string) {
    const listed = await this.client.from("story_items").select("image_path").eq("subsection_id", id)
    this.fail(listed.error)
    const paths = ((listed.data ?? []) as { image_path: string | null }[])
      .map((row) => row.image_path)
      .filter((path): path is string => Boolean(path))
    const { error } = await this.client.from("plot_subsections").delete().eq("id", id)
    this.fail(error)
    await Promise.all(paths.map((path) => this.deleteImage(path).catch(() => undefined)))
  }

  async listStoryItems(campaignId: string) {
    const { data, error } = await this.client
      .from("story_items")
      .select(STORY_COLUMNS)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
    this.fail(error)
    return ((data ?? []) as StoryItemRow[]).map(mapStoryItem)
  }

  async createStoryItem(input: CreateStoryItemInput) {
    const { data, error } = await this.client
      .from("story_items")
      .insert({
        campaign_id: input.campaignId,
        subsection_id: input.subsectionId,
        kind: input.kind,
        name: input.name.trim(),
        session_date: input.sessionDate,
      })
      .select(STORY_COLUMNS)
      .single()
    this.fail(error)
    return mapStoryItem(data as StoryItemRow)
  }

  async updateStoryItem(id: string, patch: StoryItemPatch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.sessionDate !== undefined) row.session_date = patch.sessionDate
    if (patch.body !== undefined) row.body = patch.body
    if (patch.imagePath !== undefined) row.image_path = patch.imagePath
    if (patch.resolved !== undefined) row.resolved = patch.resolved
    if (patch.showOnHome !== undefined) row.show_on_home = patch.showOnHome
    const { error } = await this.client.from("story_items").update(row).eq("id", id)
    this.fail(error)
  }

  async deleteStoryItem(id: string) {
    const existing = await this.client.from("story_items").select("image_path").eq("id", id).maybeSingle()
    const path = (existing.data as { image_path: string | null } | null)?.image_path
    const { error } = await this.client.from("story_items").delete().eq("id", id)
    this.fail(error)
    if (path) await this.deleteImage(path)
  }

  async listPcSheets(campaignId: string) {
    const listed = await this.client.from("pc_sheets").select(PC_COLUMNS).eq("campaign_id", campaignId)
    this.fail(listed.error)
    const sheets = ((listed.data ?? []) as PcSheetRow[]).map(mapPcSheet)
    const entries = await this.client
      .from("entries")
      .select("id, campaign_id, body")
      .eq("campaign_id", campaignId)
      .eq("section", "pcs")
    this.fail(entries.error)
    const characters = (entries.data ?? []) as { id: string; campaign_id: string; body: unknown }[]
    const have = new Set(sheets.map((sheet) => sheet.entryId))
    const missing = characters.filter((entry) => !have.has(entry.id))
    if (missing.length === 0) return sheets

    const alliances = await this.client
      .from("list_items")
      .select("id, entry_id, list_key, label, created_at")
      .in(
        "entry_id",
        missing.map((entry) => entry.id),
      )
    this.fail(alliances.error)
    const rows = missing.map((entry) => {
      const people = ((alliances.data ?? []) as AllianceRow[])
        .filter((item) => item.entry_id === entry.id && item.list_key === "alliances")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((item) => ({ id: item.id, label: item.label }))
      const sheet = pcSheetFromEntry(
        { id: entry.id, campaignId: entry.campaign_id, body: asDoc(entry.body) },
        people,
        new Date().toISOString(),
      )
      return {
        entry_id: sheet.entryId,
        campaign_id: sheet.campaignId,
        class_name: sheet.className,
        subclass: sheet.subclass,
        sheet_url: sheet.sheetUrl,
        bio: sheet.bio,
        subclass_notes: sheet.subclassNotes,
        people: sheet.people,
        events: sheet.events,
        objectives: sheet.objectives,
      }
    })
    const inserted = await this.client.from("pc_sheets").insert(rows).select(PC_COLUMNS)
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("pc_sheets").select(PC_COLUMNS).eq("campaign_id", campaignId)
      this.fail(again.error)
      return ((again.data ?? []) as PcSheetRow[]).map(mapPcSheet)
    }
    this.fail(inserted.error)
    return [...sheets, ...((inserted.data ?? []) as PcSheetRow[]).map(mapPcSheet)]
  }

  async createPcSheet(entryId: string) {
    const existing = await this.client.from("pc_sheets").select(PC_COLUMNS).eq("entry_id", entryId).maybeSingle()
    this.fail(existing.error)
    if (existing.data) return mapPcSheet(existing.data as PcSheetRow)

    const entry = await this.client.from("entries").select("id, campaign_id, body").eq("id", entryId).maybeSingle()
    this.fail(entry.error)
    const row = entry.data as { id: string; campaign_id: string; body: unknown } | null
    if (!row) throw new DataError("That character is gone.")

    const alliances = await this.client
      .from("list_items")
      .select("id, entry_id, list_key, label, created_at")
      .eq("entry_id", entryId)
    this.fail(alliances.error)
    const people = ((alliances.data ?? []) as AllianceRow[])
      .filter((item) => item.list_key === "alliances")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((item) => ({ id: item.id, label: item.label }))
    const sheet = pcSheetFromEntry({ id: row.id, campaignId: row.campaign_id, body: asDoc(row.body) }, people, new Date().toISOString())
    const inserted = await this.client
      .from("pc_sheets")
      .insert({
        entry_id: sheet.entryId,
        campaign_id: sheet.campaignId,
        class_name: sheet.className,
        subclass: sheet.subclass,
        sheet_url: sheet.sheetUrl,
        bio: sheet.bio,
        subclass_notes: sheet.subclassNotes,
        people: sheet.people,
        events: sheet.events,
        objectives: sheet.objectives,
      })
      .select(PC_COLUMNS)
      .single()
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("pc_sheets").select(PC_COLUMNS).eq("entry_id", entryId).single()
      this.fail(again.error)
      return mapPcSheet(again.data as PcSheetRow)
    }
    this.fail(inserted.error)
    return mapPcSheet(inserted.data as PcSheetRow)
  }

  async updatePcSheet(entryId: string, patch: PcSheetPatch) {
    const row: Record<string, unknown> = {}
    if (patch.className !== undefined) row.class_name = patch.className
    if (patch.subclass !== undefined) row.subclass = patch.subclass
    if (patch.sheetUrl !== undefined) row.sheet_url = patch.sheetUrl
    if (patch.bio !== undefined) row.bio = patch.bio
    if (patch.subclassNotes !== undefined) row.subclass_notes = patch.subclassNotes
    if (patch.people !== undefined) row.people = patch.people
    if (patch.events !== undefined) row.events = patch.events
    if (patch.objectives !== undefined) row.objectives = patch.objectives
    if (Object.keys(row).length === 0) return
    const { error } = await this.client.from("pc_sheets").update(row).eq("entry_id", entryId)
    this.fail(error)
    const touched = await this.client.from("entries").update({ updated_at: new Date().toISOString() }).eq("id", entryId)
    this.fail(touched.error)
  }

  async listNpcSheets(campaignId: string) {
    const listed = await this.client.from("npc_sheets").select(NPC_COLUMNS).eq("campaign_id", campaignId)
    this.fail(listed.error)
    const sheets = ((listed.data ?? []) as NpcSheetRow[]).map(mapNpcSheet)
    const entries = await this.client
      .from("entries")
      .select("id, campaign_id, body")
      .eq("campaign_id", campaignId)
      .eq("section", "npcs")
    this.fail(entries.error)
    const characters = (entries.data ?? []) as { id: string; campaign_id: string; body: unknown }[]
    const have = new Set(sheets.map((sheet) => sheet.entryId))
    const missing = characters.filter((entry) => !have.has(entry.id))
    if (missing.length === 0) return sheets

    const alliances = await this.client
      .from("list_items")
      .select("id, entry_id, list_key, label, created_at")
      .in(
        "entry_id",
        missing.map((entry) => entry.id),
      )
    this.fail(alliances.error)
    const rows = missing.map((entry) => {
      const people = ((alliances.data ?? []) as AllianceRow[])
        .filter((item) => item.entry_id === entry.id && item.list_key === "alliances")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((item) => ({ id: item.id, label: item.label }))
      const sheet = npcSheetFromEntry(
        { id: entry.id, campaignId: entry.campaign_id, body: asDoc(entry.body) },
        people,
        new Date().toISOString(),
      )
      return {
        entry_id: sheet.entryId,
        campaign_id: sheet.campaignId,
        description: sheet.description,
        motivations: sheet.motivations,
        affinity: sheet.affinity,
        hostile_at: sheet.hostileAt,
        friendly_at: sheet.friendlyAt,
        people: sheet.people,
      }
    })
    const inserted = await this.client.from("npc_sheets").insert(rows).select(NPC_COLUMNS)
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("npc_sheets").select(NPC_COLUMNS).eq("campaign_id", campaignId)
      this.fail(again.error)
      return ((again.data ?? []) as NpcSheetRow[]).map(mapNpcSheet)
    }
    this.fail(inserted.error)
    return [...sheets, ...((inserted.data ?? []) as NpcSheetRow[]).map(mapNpcSheet)]
  }

  async createNpcSheet(entryId: string) {
    const existing = await this.client.from("npc_sheets").select(NPC_COLUMNS).eq("entry_id", entryId).maybeSingle()
    this.fail(existing.error)
    if (existing.data) return mapNpcSheet(existing.data as NpcSheetRow)

    const entry = await this.client.from("entries").select("id, campaign_id, body").eq("id", entryId).maybeSingle()
    this.fail(entry.error)
    const row = entry.data as { id: string; campaign_id: string; body: unknown } | null
    if (!row) throw new DataError("That character is gone.")

    const alliances = await this.client
      .from("list_items")
      .select("id, entry_id, list_key, label, created_at")
      .eq("entry_id", entryId)
    this.fail(alliances.error)
    const people = ((alliances.data ?? []) as AllianceRow[])
      .filter((item) => item.list_key === "alliances")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((item) => ({ id: item.id, label: item.label }))
    const sheet = npcSheetFromEntry({ id: row.id, campaignId: row.campaign_id, body: asDoc(row.body) }, people, new Date().toISOString())
    const inserted = await this.client
      .from("npc_sheets")
      .insert({
        entry_id: sheet.entryId,
        campaign_id: sheet.campaignId,
        description: sheet.description,
        motivations: sheet.motivations,
        affinity: sheet.affinity,
        hostile_at: sheet.hostileAt,
        friendly_at: sheet.friendlyAt,
        people: sheet.people,
      })
      .select(NPC_COLUMNS)
      .single()
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("npc_sheets").select(NPC_COLUMNS).eq("entry_id", entryId).single()
      this.fail(again.error)
      return mapNpcSheet(again.data as NpcSheetRow)
    }
    this.fail(inserted.error)
    return mapNpcSheet(inserted.data as NpcSheetRow)
  }

  async updateNpcSheet(entryId: string, patch: NpcSheetPatch) {
    const row: Record<string, unknown> = {}
    if (patch.description !== undefined) row.description = patch.description
    if (patch.motivations !== undefined) row.motivations = patch.motivations
    if (patch.affinity !== undefined) row.affinity = patch.affinity
    if (patch.hostileAt !== undefined) row.hostile_at = patch.hostileAt
    if (patch.friendlyAt !== undefined) row.friendly_at = patch.friendlyAt
    if (patch.people !== undefined) row.people = patch.people
    if (Object.keys(row).length === 0) return
    const { error } = await this.client.from("npc_sheets").update(row).eq("entry_id", entryId)
    this.fail(error)
    const touched = await this.client.from("entries").update({ updated_at: new Date().toISOString() }).eq("id", entryId)
    this.fail(touched.error)
  }

  async listCatalogSheets(campaignId: string) {
    const listed = await this.client.from("catalog_sheets").select(CATALOG_COLUMNS).eq("campaign_id", campaignId)
    this.fail(listed.error)
    const sheets = ((listed.data ?? []) as CatalogSheetRow[]).map(mapCatalogSheet)
    const entries = await this.client
      .from("entries")
      .select("id, campaign_id, section, body")
      .eq("campaign_id", campaignId)
      .in("section", ["afflictions", "locations", "misc"])
    this.fail(entries.error)
    const records = (entries.data ?? []) as { id: string; campaign_id: string; section: PanelSectionId; body: unknown }[]
    const have = new Set(sheets.map((sheet) => sheet.entryId))
    const missing = records.filter((entry) => !have.has(entry.id))
    if (missing.length === 0) return sheets
    const rows = missing.map((entry) => {
      const sheet = catalogSheetFromEntry(
        { id: entry.id, campaignId: entry.campaign_id, section: entry.section, body: asDoc(entry.body) },
        new Date().toISOString(),
      )
      return catalogInsert(sheet)
    })
    const inserted = await this.client.from("catalog_sheets").insert(rows).select(CATALOG_COLUMNS)
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("catalog_sheets").select(CATALOG_COLUMNS).eq("campaign_id", campaignId)
      this.fail(again.error)
      return ((again.data ?? []) as CatalogSheetRow[]).map(mapCatalogSheet)
    }
    this.fail(inserted.error)
    return [...sheets, ...((inserted.data ?? []) as CatalogSheetRow[]).map(mapCatalogSheet)]
  }

  async createCatalogSheet(entryId: string) {
    const existing = await this.client.from("catalog_sheets").select(CATALOG_COLUMNS).eq("entry_id", entryId).maybeSingle()
    this.fail(existing.error)
    if (existing.data) return mapCatalogSheet(existing.data as CatalogSheetRow)

    const entry = await this.client.from("entries").select("id, campaign_id, section, body").eq("id", entryId).maybeSingle()
    this.fail(entry.error)
    const row = entry.data as { id: string; campaign_id: string; section: PanelSectionId; body: unknown } | null
    if (!row) throw new DataError("That entry is gone.")
    const sheet = catalogSheetFromEntry(
      { id: row.id, campaignId: row.campaign_id, section: row.section, body: asDoc(row.body) },
      new Date().toISOString(),
    )
    const inserted = await this.client.from("catalog_sheets").insert(catalogInsert(sheet)).select(CATALOG_COLUMNS).single()
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("catalog_sheets").select(CATALOG_COLUMNS).eq("entry_id", entryId).single()
      this.fail(again.error)
      return mapCatalogSheet(again.data as CatalogSheetRow)
    }
    this.fail(inserted.error)
    return mapCatalogSheet(inserted.data as CatalogSheetRow)
  }

  async updateCatalogSheet(entryId: string, patch: CatalogSheetPatch) {
    const row: Record<string, unknown> = {}
    if (patch.savingThrow !== undefined) row.saving_throw = patch.savingThrow
    if (patch.damage !== undefined) row.damage = patch.damage
    if (patch.place !== undefined) row.place = patch.place
    if (patch.effect !== undefined) row.effect = patch.effect
    if (patch.notes !== undefined) row.notes = patch.notes
    if (Object.keys(row).length === 0) return
    const { error } = await this.client.from("catalog_sheets").update(row).eq("entry_id", entryId)
    this.fail(error)
    const touched = await this.client.from("entries").update({ updated_at: new Date().toISOString() }).eq("id", entryId)
    this.fail(touched.error)
  }

  async listMonsterSheets(campaignId: string) {
    const listed = await this.client.from("monster_sheets").select(MONSTER_COLUMNS).eq("campaign_id", campaignId)
    this.fail(listed.error)
    const sheets = ((listed.data ?? []) as MonsterSheetRow[]).map(mapMonsterSheet)
    const entries = await this.client.from("entries").select("id, campaign_id, body").eq("campaign_id", campaignId).eq("section", "monsters")
    this.fail(entries.error)
    const records = (entries.data ?? []) as { id: string; campaign_id: string; body: unknown }[]
    const have = new Set(sheets.map((sheet) => sheet.entryId))
    const missing = records.filter((entry) => !have.has(entry.id))
    if (missing.length === 0) return sheets
    const rows = missing.map((entry) =>
      monsterInsert(monsterSheetFromEntry({ id: entry.id, campaignId: entry.campaign_id, body: asDoc(entry.body) }, new Date().toISOString())),
    )
    const inserted = await this.client.from("monster_sheets").insert(rows).select(MONSTER_COLUMNS)
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("monster_sheets").select(MONSTER_COLUMNS).eq("campaign_id", campaignId)
      this.fail(again.error)
      return ((again.data ?? []) as MonsterSheetRow[]).map(mapMonsterSheet)
    }
    this.fail(inserted.error)
    return [...sheets, ...((inserted.data ?? []) as MonsterSheetRow[]).map(mapMonsterSheet)]
  }

  async createMonsterSheet(entryId: string) {
    const existing = await this.client.from("monster_sheets").select(MONSTER_COLUMNS).eq("entry_id", entryId).maybeSingle()
    this.fail(existing.error)
    if (existing.data) return mapMonsterSheet(existing.data as MonsterSheetRow)

    const entry = await this.client.from("entries").select("id, campaign_id, body").eq("id", entryId).maybeSingle()
    this.fail(entry.error)
    const row = entry.data as { id: string; campaign_id: string; body: unknown } | null
    if (!row) throw new DataError("That creature is gone.")
    const sheet = monsterSheetFromEntry({ id: row.id, campaignId: row.campaign_id, body: asDoc(row.body) }, new Date().toISOString())
    const inserted = await this.client.from("monster_sheets").insert(monsterInsert(sheet)).select(MONSTER_COLUMNS).single()
    if (inserted.error?.code === "23505") {
      const again = await this.client.from("monster_sheets").select(MONSTER_COLUMNS).eq("entry_id", entryId).single()
      this.fail(again.error)
      return mapMonsterSheet(again.data as MonsterSheetRow)
    }
    this.fail(inserted.error)
    return mapMonsterSheet(inserted.data as MonsterSheetRow)
  }

  async updateMonsterSheet(entryId: string, patch: MonsterSheetPatch) {
    const row = monsterPatch(patch)
    if (Object.keys(row).length === 0) return
    const { error } = await this.client.from("monster_sheets").update(row).eq("entry_id", entryId)
    this.fail(error)
    const touched = await this.client.from("entries").update({ updated_at: new Date().toISOString() }).eq("id", entryId)
    this.fail(touched.error)
  }

  async listStickyNotes(campaignId: string) {
    const { data, error } = await this.client
      .from("sticky_notes")
      .select("id, campaign_id, body, character_id, created_at, updated_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
    this.fail(error)
    return ((data ?? []) as StickyNoteRow[]).map(mapStickyNote)
  }

  async createStickyNote(campaignId: string) {
    const { data, error } = await this.client
      .from("sticky_notes")
      .insert({ campaign_id: campaignId, body: "" })
      .select("id, campaign_id, body, character_id, created_at, updated_at")
      .single()
    this.fail(error)
    return mapStickyNote(data as StickyNoteRow)
  }

  async updateStickyNote(id: string, patch: StickyNotePatch) {
    const row: Record<string, unknown> = {}
    if (patch.body !== undefined) row.body = patch.body
    if (patch.characterId !== undefined) row.character_id = patch.characterId
    if (Object.keys(row).length === 0) return
    const { error } = await this.client.from("sticky_notes").update(row).eq("id", id)
    this.fail(error)
  }

  async deleteStickyNote(id: string) {
    const { error } = await this.client.from("sticky_notes").delete().eq("id", id)
    this.fail(error)
  }

  async uploadImage(campaignId: string, file: File) {
    validateImage(file)
    const userId = await this.requireUserId()
    const path = `${userId}/${campaignId}/${crypto.randomUUID()}.${extensionFor(file)}`
    const { error } = await this.client.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    this.fail(error)
    return path
  }

  async imageUrl(path: string) {
    const cached = this.urls.get(path)
    if (cached && cached.expires > Date.now() + 15_000) return cached.url
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
    this.fail(error)
    if (!data?.signedUrl) return null
    this.urls.set(path, { url: data.signedUrl, expires: Date.now() + 60 * 60 * 1000 })
    return data.signedUrl
  }

  async deleteImage(path: string) {
    this.urls.delete(path)
    const { error } = await this.client.storage.from(BUCKET).remove([path])
    this.fail(error)
  }

  private async removeCampaignImages(campaignId: string) {
    const userId = await this.requireUserId()
    const folder = `${userId}/${campaignId}`
    const { data, error } = await this.client.storage.from(BUCKET).list(folder)
    this.fail(error)
    const paths = (data ?? []).map((file) => `${folder}/${file.name}`)
    if (paths.length === 0) return
    const removed = await this.client.storage.from(BUCKET).remove(paths)
    this.fail(removed.error)
    for (const path of paths) this.urls.delete(path)
  }
}
