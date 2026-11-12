import type { SupabaseClient } from "@supabase/supabase-js"
import { extensionFor, validateImage } from "./images.ts"
import { DataError, type CreateEntryInput, type CreateLinkInput, type CreateListItemInput, type CreateStoryItemInput, type Repository } from "./repository.ts"
import { asDoc } from "./text.ts"
import type { Campaign, CampaignPatch, Entry, EntryLink, EntryPatch, ListItem, PanelSectionId, PlotSubsection, PlotSubsectionPatch, StoryItem, StoryItemPatch, StoryKind } from "./types.ts"

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
  resolved: boolean
  show_on_home: boolean
  created_at: string
  updated_at: string
}

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
    resolved: row.resolved,
    showOnHome: row.show_on_home,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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
    const { error } = await this.client.from("plot_subsections").delete().eq("id", id)
    this.fail(error)
  }

  async listStoryItems(campaignId: string) {
    const { data, error } = await this.client
      .from("story_items")
      .select("id, campaign_id, subsection_id, kind, name, session_date, body, resolved, show_on_home, created_at, updated_at")
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
      .select("id, campaign_id, subsection_id, kind, name, session_date, body, resolved, show_on_home, created_at, updated_at")
      .single()
    this.fail(error)
    return mapStoryItem(data as StoryItemRow)
  }

  async updateStoryItem(id: string, patch: StoryItemPatch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.sessionDate !== undefined) row.session_date = patch.sessionDate
    if (patch.body !== undefined) row.body = patch.body
    if (patch.resolved !== undefined) row.resolved = patch.resolved
    if (patch.showOnHome !== undefined) row.show_on_home = patch.showOnHome
    const { error } = await this.client.from("story_items").update(row).eq("id", id)
    this.fail(error)
  }

  async deleteStoryItem(id: string) {
    const { error } = await this.client.from("story_items").delete().eq("id", id)
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
