import { uid } from "./ids.ts"
import { asDoc } from "./text.ts"
import type { AbilityScores, MonsterSheet, RichDoc, StatLine } from "./types.ts"

export type MonsterDraft = Omit<MonsterSheet, "entryId" | "campaignId" | "notes" | "updatedAt"> & { name: string }

export type CompendiumCreature = {
  key: string
  name: string
  challenge: string
  detail: string
  source: string
  draft: MonsterDraft
}

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const

const ABILITY_NAMES: Record<(typeof ABILITY_KEYS)[number], string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
}

export function blankAbilities(): AbilityScores {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
}

export function abilityModifier(score: number) {
  if (!Number.isFinite(score)) return "+0"
  const modifier = Math.floor((Math.trunc(score) - 10) / 2)
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}

export function challengeLabel(challenge: string) {
  return challenge.trim().replace(/\s*\([^)]*\)\s*$/, "")
}

export function monsterSheetFromEntry(
  entry: { id: string; campaignId: string; body: RichDoc },
  timestamp: string,
): MonsterSheet {
  return {
    entryId: entry.id,
    campaignId: entry.campaignId,
    ...blankStats(),
    notes: asDoc(entry.body),
    updatedAt: timestamp,
  }
}

export function normalizeMonsterSheet(value: unknown): MonsterSheet | null {
  if (!isRecord(value)) return null
  if (typeof value.entryId !== "string" || typeof value.campaignId !== "string") return null
  return {
    entryId: value.entryId,
    campaignId: value.campaignId,
    ...statsFrom(value),
    notes: asDoc(value.notes),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  }
}

export function draftToPatch(draft: MonsterDraft): Omit<MonsterDraft, "name"> {
  const { name: _name, ...stats } = draft
  return stats
}

export function parseCompendium(value: unknown): MonsterDraft[] {
  const drafts = unwrap(value).flatMap((record) => {
    const draft = toDraft(record)
    return draft ? [draft] : []
  })
  const seen = new Set<string>()
  return drafts.filter((draft) => {
    const key = [draft.name, draft.source, draft.challenge, draft.armorClass, draft.hitPoints].join("\0")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchCompendium(query: string): Promise<CompendiumCreature[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const params = new URLSearchParams({
    name__icontains: trimmed,
    document__key__in: "srd-2014,srd-2024",
    limit: "12",
  })
  let response: Response
  try {
    response = await fetch(`https://api.open5e.com/v2/creatures/?${params.toString()}`)
  } catch {
    throw new Error("The compendium is unreachable.")
  }
  if (!response.ok) throw new Error("The compendium didn't respond.")
  const body: unknown = await response.json()
  return unwrap(body).flatMap((record) => {
    const draft = toDraft(record)
    if (!draft) return []
    return [
      {
        key: asString(record.key) || `${draft.name}-${draft.source}`,
        name: draft.name,
        challenge: challengeLabel(draft.challenge),
        detail: [draft.size, draft.creatureType].filter(Boolean).join(" "),
        source: draft.source,
        draft,
      },
    ]
  })
}

function blankStats(): Omit<MonsterSheet, "entryId" | "campaignId" | "notes" | "updatedAt"> {
  return {
    ...emptyStats(),
    source: "",
  }
}

function emptyStats(): Omit<MonsterDraft, "name" | "source"> & { source: string } {
  return {
    size: "",
    creatureType: "",
    alignment: "",
    armorClass: "",
    hitPoints: "",
    speed: "",
    abilities: blankAbilities(),
    savingThrows: "",
    skills: "",
    damageVulnerabilities: "",
    damageResistances: "",
    damageImmunities: "",
    conditionImmunities: "",
    senses: "",
    languages: "",
    challenge: "",
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    source: "",
  }
}

function statsFrom(record: Record<string, unknown>): Omit<MonsterSheet, "entryId" | "campaignId" | "notes" | "updatedAt"> {
  return {
    size: asString(record.size),
    creatureType: asString(record.creatureType),
    alignment: asString(record.alignment),
    armorClass: asString(record.armorClass),
    hitPoints: asString(record.hitPoints),
    speed: asString(record.speed),
    abilities: asAbilities(record.abilities),
    savingThrows: asString(record.savingThrows),
    skills: asString(record.skills),
    damageVulnerabilities: asString(record.damageVulnerabilities),
    damageResistances: asString(record.damageResistances),
    damageImmunities: asString(record.damageImmunities),
    conditionImmunities: asString(record.conditionImmunities),
    senses: asString(record.senses),
    languages: asString(record.languages),
    challenge: asString(record.challenge),
    traits: asLines(record.traits),
    actions: asLines(record.actions),
    bonusActions: asLines(record.bonusActions),
    reactions: asLines(record.reactions),
    legendaryActions: asLines(record.legendaryActions),
    source: asString(record.source),
  }
}

function toDraft(record: Record<string, unknown>): MonsterDraft | null {
  const name = asString(record.name)
  if (!name) return null
  if (isTableDraft(record)) return { name, ...statsFrom(record) }
  if (!looksLikeCreature(record)) return null
  return draftFromCreature(record, name)
}

function isTableDraft(record: Record<string, unknown>) {
  const published =
    record.armor_class !== undefined ||
    record.hit_points !== undefined ||
    record.ability_scores !== undefined ||
    typeof record.strength === "number"
  if (published) return false
  return typeof record.armorClass === "string" || typeof record.creatureType === "string" || Array.isArray(record.traits) || Array.isArray(record.actions)
}

function looksLikeCreature(record: Record<string, unknown>) {
  return (
    record.armor_class !== undefined ||
    record.hit_points !== undefined ||
    record.ability_scores !== undefined ||
    typeof record.strength === "number" ||
    record.challenge_rating !== undefined ||
    Array.isArray(record.special_abilities)
  )
}

function draftFromCreature(record: Record<string, unknown>, name: string): MonsterDraft {
  const groups = splitActions(record)
  return {
    name,
    size: named(record.size),
    creatureType: named(record.type) || named(record.creature_type),
    alignment: asString(record.alignment),
    armorClass: formatArmor(record),
    hitPoints: formatHitPoints(record),
    speed: formatSpeed(record.speed),
    abilities: asAbilities(isRecord(record.ability_scores) ? record.ability_scores : record),
    savingThrows: formatPairs(record.saving_throws),
    skills: formatPairs(record.skill_bonuses ?? record.skills),
    damageVulnerabilities: resistanceText(record, "damage_vulnerabilities"),
    damageResistances: resistanceText(record, "damage_resistances"),
    damageImmunities: resistanceText(record, "damage_immunities"),
    conditionImmunities: resistanceText(record, "condition_immunities"),
    senses: formatSenses(record),
    languages: formatLanguages(record.languages),
    challenge: formatChallenge(record),
    traits: Array.isArray(record.traits) ? asLines(record.traits) : asLines(record.special_abilities),
    actions: groups.actions,
    bonusActions: groups.bonusActions,
    reactions: groups.reactions,
    legendaryActions: groups.legendaryActions,
    source: sourceOf(record),
  }
}

function splitActions(record: Record<string, unknown>) {
  const actions = record.actions
  const typed =
    Array.isArray(actions) &&
    actions.some((item) => isRecord(item) && asString(item.action_type))
  if (typed) {
    return {
      actions: actionLines(actions, "ACTION"),
      bonusActions: [...actionLines(actions, "BONUS_ACTION"), ...actionLines(record.bonus_actions, null)],
      reactions: [...actionLines(actions, "REACTION"), ...actionLines(record.reactions, null)],
      legendaryActions: [...actionLines(actions, "LEGENDARY_ACTION"), ...actionLines(record.legendary_actions, null)],
    }
  }
  return {
    actions: actionLines(actions, null),
    bonusActions: actionLines(record.bonus_actions, null),
    reactions: actionLines(record.reactions, null),
    legendaryActions: actionLines(record.legendary_actions, null),
  }
}

function actionLines(items: unknown, type: string | null): StatLine[] {
  if (!Array.isArray(items)) return []
  const rows = items.flatMap((item, index) => {
    if (!isRecord(item)) return []
    const actionType = asString(item.action_type)
    if (type && actionType !== type) return []
    if (!type && actionType && actionType !== "ACTION") return []
    const order = typeof item.order_in_statblock === "number" ? item.order_in_statblock : index
    return [{ item, order }]
  })
  rows.sort((a, b) => a.order - b.order)
  return asLines(rows.map((row) => row.item))
}

function formatArmor(record: Record<string, unknown>) {
  const armor = record.armor_class
  const detail = asString(record.armor_detail)
  if (typeof armor === "number") return detail ? `${armor} (${detail})` : String(armor)
  if (typeof armor === "string") return armor.trim()
  if (!Array.isArray(armor)) return ""
  return armor
    .map((item) => {
      if (typeof item === "number") return String(item)
      if (!isRecord(item) || typeof item.value !== "number") return ""
      const type = asString(item.type).replaceAll("_", " ")
      return type ? `${item.value} (${type})` : String(item.value)
    })
    .filter(Boolean)
    .join(", ")
}

function formatHitPoints(record: Record<string, unknown>) {
  const points = record.hit_points
  const dice = asString(record.hit_dice)
  if (typeof points === "number" && dice) return `${points} (${dice})`
  if (typeof points === "number") return String(points)
  if (typeof points === "string" && points.trim()) return points.trim()
  return dice
}

function formatSpeed(speed: unknown) {
  if (typeof speed === "string") return speed.trim()
  if (!isRecord(speed)) return ""
  const unit = asString(speed.unit) === "feet" || !asString(speed.unit) ? "ft." : asString(speed.unit)
  const parts: string[] = []
  for (const key of ["walk", "burrow", "climb", "fly", "swim"]) {
    const value = speed[key]
    if (typeof value === "number" && value > 0) {
      const label = `${value} ${unit}`
      parts.push(key === "walk" ? label : `${key} ${label}`)
    } else if (typeof value === "string" && value.trim()) {
      parts.push(key === "walk" ? value.trim() : `${key} ${value.trim()}`)
    }
  }
  if (speed.hover === true) {
    const fly = parts.findIndex((part) => part.startsWith("fly "))
    if (fly >= 0) parts[fly] += " (hover)"
  }
  return parts.join(", ")
}

function formatPairs(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (!isRecord(value)) return ""
  return Object.entries(value)
    .flatMap(([key, bonus]) => (typeof bonus === "number" && Number.isFinite(bonus) ? [`${labelize(key)} ${signed(bonus)}`] : []))
    .join(", ")
}

function formatSenses(record: Record<string, unknown>) {
  const parts: string[] = []
  const add = (label: string, key: string) => {
    const value = record[key]
    if (typeof value === "number" && value > 0 && value < 1000) parts.push(`${label} ${value} ft.`)
  }
  add("blindsight", "blindsight_range")
  add("darkvision", "darkvision_range")
  add("tremorsense", "tremorsense_range")
  add("truesight", "truesight_range")
  if (typeof record.passive_perception === "number") parts.push(`passive Perception ${record.passive_perception}`)
  if (parts.length > 0) return parts.join(", ")
  return asString(record.senses)
}

function formatLanguages(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (isRecord(value)) return asString(value.as_string)
  return ""
}

function formatChallenge(record: Record<string, unknown>) {
  const label = crLabel(record.challenge_rating ?? record.cr)
  if (!label) return ""
  const xp = record.experience_points ?? record.xp
  if (typeof xp === "number" && xp > 0) return `${label} (${xp.toLocaleString("en-US")} XP)`
  return label
}

function crLabel(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  if (value === 0.125) return "1/8"
  if (value === 0.25) return "1/4"
  if (value === 0.5) return "1/2"
  return String(value)
}

function resistanceText(record: Record<string, unknown>, key: string) {
  const nested = record.resistances_and_immunities
  if (isRecord(nested)) {
    const display = asString(nested[`${key}_display`])
    if (display) return display
    const list = nested[key]
    if (Array.isArray(list)) return list.map(named).filter(Boolean).join(", ")
  }
  const flat = record[key]
  if (typeof flat === "string") return flat.trim()
  if (Array.isArray(flat)) return flat.map(named).filter(Boolean).join(", ")
  return ""
}

function sourceOf(record: Record<string, unknown>) {
  if (typeof record.source === "string" && record.source.trim()) return record.source.trim()
  const document = record.document
  if (!isRecord(document)) return ""
  const key = asString(document.key)
  if (key === "srd-2014") return "SRD 5.1"
  if (key === "srd-2024") return "SRD 5.2"
  return asString(document.display_name) || asString(document.name)
}

function asAbilities(value: unknown): AbilityScores {
  const row = isRecord(value) ? value : {}
  const scores = blankAbilities()
  for (const key of ABILITY_KEYS) {
    const full = row[ABILITY_NAMES[key]]
    const short = row[key]
    const score = typeof full === "number" ? full : short
    if (typeof score === "number" && Number.isFinite(score)) scores[key] = Math.trunc(score)
  }
  return scores
}

function asLines(value: unknown): StatLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const name = lineName(item)
    const text = asString(item.text) || asString(item.desc) || asString(item.description)
    if (!name && !text) return []
    const id = typeof item.id === "string" && item.id ? item.id : uid()
    return [{ id, name, text }]
  })
}

function lineName(row: Record<string, unknown>) {
  const name = asString(row.name)
  const cost = row.legendary_action_cost
  if (!name || typeof cost !== "number" || cost <= 1 || /costs\s+\d+/i.test(name)) return name
  return `${name} (Costs ${cost} Actions)`
}

function named(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  if (isRecord(value)) return asString(value.name)
  return ""
}

function labelize(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function signed(value: number) {
  const number = Math.trunc(value)
  return number >= 0 ? `+${number}` : String(number)
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function unwrap(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  for (const key of ["results", "monsters", "creatures", "data", "items"]) {
    const nested = value[key]
    if (Array.isArray(nested)) return nested.filter(isRecord)
  }
  return [value]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
