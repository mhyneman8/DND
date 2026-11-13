import { asDoc, emptyDoc } from "./text.ts"
import type { PcEvent, PcObjective, PcPerson, PcSheet, RichDoc } from "./types.ts"

export function pcSheetFromEntry(
  entry: { id: string; campaignId: string; body: RichDoc },
  people: PcPerson[],
  timestamp: string,
): PcSheet {
  return {
    entryId: entry.id,
    campaignId: entry.campaignId,
    className: "",
    subclass: "",
    sheetUrl: "",
    bio: asDoc(entry.body),
    subclassNotes: emptyDoc(),
    people,
    events: [],
    objectives: [],
    updatedAt: timestamp,
  }
}

export function normalizePcSheet(value: unknown): PcSheet | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<PcSheet>
  if (typeof row.entryId !== "string" || typeof row.campaignId !== "string") return null
  return {
    entryId: row.entryId,
    campaignId: row.campaignId,
    className: typeof row.className === "string" ? row.className : "",
    subclass: typeof row.subclass === "string" ? row.subclass : "",
    sheetUrl: typeof row.sheetUrl === "string" ? row.sheetUrl : "",
    bio: asDoc(row.bio),
    subclassNotes: asDoc(row.subclassNotes),
    people: asPcPeople(row.people),
    events: asPcEvents(row.events),
    objectives: asPcObjectives(row.objectives),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
  }
}

export function asPcPeople(value: unknown): PcPerson[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Partial<PcPerson>
    if (typeof row.id !== "string" || typeof row.label !== "string") return []
    return [{ id: row.id, label: row.label }]
  })
}

export function asPcEvents(value: unknown): PcEvent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Partial<PcEvent>
    if (typeof row.id !== "string" || typeof row.createdAt !== "string") return []
    return [
      {
        id: row.id,
        sessionTag: typeof row.sessionTag === "string" ? row.sessionTag : "",
        text: typeof row.text === "string" ? row.text : "",
        createdAt: row.createdAt,
      },
    ]
  })
}

export function asPcObjectives(value: unknown): PcObjective[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Partial<PcObjective>
    if (typeof row.id !== "string" || typeof row.label !== "string") return []
    return [{ id: row.id, label: row.label }]
  })
}

export function externalHref(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withProtocol)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

export function orderByIds<T extends { id: string }>(items: T[], ids: string[]) {
  const byId = new Map(items.map((item) => [item.id, item]))
  const next = ids.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
  for (const item of items) {
    if (!next.some((candidate) => candidate.id === item.id)) next.push(item)
  }
  return next
}
