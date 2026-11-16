import { asPcPeople } from "./pc.ts"
import { asDoc, emptyDoc } from "./text.ts"
import type { AffinityTone, NpcSheet, PcPerson, RichDoc } from "./types.ts"

export const DEFAULT_HOSTILE_AT = -1
export const DEFAULT_FRIENDLY_AT = 1

export const AFFINITY_COLORS: Record<AffinityTone, string> = {
  hostile: "#e07a6a",
  neutral: "#c9bbaa",
  friendly: "#9cbe72",
}

export const AFFINITY_LABELS: Record<AffinityTone, string> = {
  hostile: "Hostile",
  neutral: "Neutral",
  friendly: "Friendly",
}

export function npcSheetFromEntry(
  entry: { id: string; campaignId: string; body: RichDoc },
  people: PcPerson[],
  timestamp: string,
): NpcSheet {
  return {
    entryId: entry.id,
    campaignId: entry.campaignId,
    description: asDoc(entry.body),
    motivations: emptyDoc(),
    affinity: 0,
    hostileAt: DEFAULT_HOSTILE_AT,
    friendlyAt: DEFAULT_FRIENDLY_AT,
    people,
    updatedAt: timestamp,
  }
}

export function normalizeNpcSheet(value: unknown): NpcSheet | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<NpcSheet>
  if (typeof row.entryId !== "string" || typeof row.campaignId !== "string") return null
  const bounds = withAffinityGap(asInt(row.hostileAt, DEFAULT_HOSTILE_AT), asInt(row.friendlyAt, DEFAULT_FRIENDLY_AT))
  return {
    entryId: row.entryId,
    campaignId: row.campaignId,
    description: asDoc(row.description),
    motivations: asDoc(row.motivations),
    affinity: asInt(row.affinity, 0),
    hostileAt: bounds.hostileAt,
    friendlyAt: bounds.friendlyAt,
    people: asPcPeople(row.people),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
  }
}

export function affinityTone(value: number, hostileAt: number, friendlyAt: number): AffinityTone {
  if (value <= hostileAt) return "hostile"
  if (value >= friendlyAt) return "friendly"
  return "neutral"
}

export function withAffinityGap(hostileAt: number, friendlyAt: number) {
  if (friendlyAt > hostileAt) return { hostileAt, friendlyAt }
  return { hostileAt, friendlyAt: hostileAt + 1 }
}

export function moveHostileAt(friendlyAt: number, next: number) {
  const hostileAt = Math.trunc(next)
  return withAffinityGap(hostileAt, hostileAt >= friendlyAt ? hostileAt + 1 : friendlyAt)
}

export function moveFriendlyAt(hostileAt: number, next: number) {
  const friendlyAt = Math.trunc(next)
  return withAffinityGap(friendlyAt <= hostileAt ? friendlyAt - 1 : hostileAt, friendlyAt)
}

function asInt(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  return fallback
}
