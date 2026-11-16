import { HeartPulse } from "lucide-react"
import { afflictionsOn } from "../lib/catalog.ts"
import type { Entry, EntryLink } from "../lib/types.ts"

export function AfflictionMark({
  entryId,
  entries,
  links,
}: {
  entryId: string
  entries: Entry[]
  links: EntryLink[]
}) {
  const afflictions = afflictionsOn(entryId, entries, links)
  if (afflictions.length === 0) return null
  const label = afflictions.map((item) => item.name).join(", ")
  return (
    <span title={label} aria-label={`Afflicted: ${label}`} className="inline-flex shrink-0 text-danger">
      <HeartPulse size={14} />
    </span>
  )
}
