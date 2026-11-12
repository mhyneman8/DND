import type { Entry, PanelSectionId, RichDoc } from "./types.ts"

export function emptyDoc(): RichDoc {
  return { type: "doc", content: [{ type: "paragraph" }] }
}

export function asDoc(value: unknown): RichDoc {
  if (value && typeof value === "object" && "type" in value && value.type === "doc") {
    return value as RichDoc
  }
  return emptyDoc()
}

export function compareNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
}

export type EntryGroup = {
  key: string
  label: string
  entries: Entry[]
}

export function groupEntries(entries: Entry[], section: PanelSectionId, query: string): EntryGroup[] {
  const needle = query.trim().toLowerCase()
  const matching = entries.filter((entry) => {
    if (entry.section !== section) return false
    if (!needle) return true
    return entry.name.toLowerCase().includes(needle)
  })

  const buckets = new Map<string, Entry[]>()
  for (const entry of matching) {
    const key = entry.subsection.trim()
    const bucket = buckets.get(key)
    if (bucket) bucket.push(entry)
    else buckets.set(key, [entry])
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => compareNames(a.name, b.name) || a.createdAt.localeCompare(b.createdAt))
  }

  return [...buckets.keys()]
    .sort((a, b) => {
      if (a === "") return -1
      if (b === "") return 1
      return compareNames(a, b)
    })
    .map((key) => ({
      key: key || "general",
      label: key || "General",
      entries: buckets.get(key) ?? [],
    }))
}

export function recentEntries(entries: Entry[], limit = 6) {
  return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit)
}

export function formatSessionDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function messageOf(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}
