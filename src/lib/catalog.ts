import { asDoc, compareNames } from "./text.ts"
import type { CatalogKind, CatalogSheet, Entry, EntryLink, PanelSectionId, RichDoc } from "./types.ts"

export function catalogKindFor(section: PanelSectionId): CatalogKind | null {
  if (section === "afflictions") return "affliction"
  if (section === "locations") return "location"
  if (section === "misc") return "item"
  return null
}

export function catalogSheetFromEntry(
  entry: { id: string; campaignId: string; section: PanelSectionId; body: RichDoc },
  timestamp: string,
): CatalogSheet {
  const kind = catalogKindFor(entry.section)
  if (!kind) throw new Error("That entry is not a catalog sheet.")
  return {
    entryId: entry.id,
    campaignId: entry.campaignId,
    kind,
    savingThrow: "",
    damage: "",
    place: "",
    effect: "",
    notes: asDoc(entry.body),
    updatedAt: timestamp,
  }
}

export function normalizeCatalogSheet(value: unknown): CatalogSheet | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<CatalogSheet>
  if (typeof row.entryId !== "string" || typeof row.campaignId !== "string") return null
  if (row.kind !== "affliction" && row.kind !== "location" && row.kind !== "item") return null
  return {
    entryId: row.entryId,
    campaignId: row.campaignId,
    kind: row.kind,
    savingThrow: asString(row.savingThrow),
    damage: asString(row.damage),
    place: asString(row.place),
    effect: asString(row.effect),
    notes: asDoc(row.notes),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
  }
}

export function linkPartner(link: EntryLink, entryId: string) {
  if (link.sourceEntryId === entryId) return link.targetEntryId
  if (link.targetEntryId === entryId) return link.sourceEntryId
  return null
}

export function linkedEntries(entryId: string, entries: Entry[], links: EntryLink[], sections: PanelSectionId[]) {
  const allowed = new Set(sections)
  const rows = links.flatMap((link) => {
    const partnerId = linkPartner(link, entryId)
    if (!partnerId) return []
    const entry = entries.find((item) => item.id === partnerId)
    if (!entry || !allowed.has(entry.section)) return []
    return [{ link, entry }]
  })
  return rows.sort((a, b) => compareNames(a.entry.name, b.entry.name))
}

export function afflictionsOn(entryId: string, entries: Entry[], links: EntryLink[]) {
  return linkedEntries(entryId, entries, links, ["afflictions"]).map((item) => item.entry)
}

function asString(value: unknown) {
  return typeof value === "string" ? value : ""
}
