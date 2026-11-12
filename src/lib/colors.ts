export const CAMPAIGN_COLORS = [
  "#e0a45a",
  "#e07a6a",
  "#e08ab0",
  "#b79af0",
  "#7eb6e6",
  "#6ec4b4",
  "#9cbe72",
  "#c4b5a4",
] as const

export const HIGHLIGHT_COLORS = [
  { id: "honey", label: "Honey", value: "#f0d48a" },
  { id: "rose", label: "Rose", value: "#f0b4b0" },
  { id: "mint", label: "Mint", value: "#b7ddc0" },
  { id: "sky", label: "Sky", value: "#b7d4f2" },
  { id: "lilac", label: "Lilac", value: "#d4c2f2" },
] as const

export function nextCampaignColor(used: string[]) {
  return CAMPAIGN_COLORS.find((color) => !used.includes(color)) ?? CAMPAIGN_COLORS[used.length % CAMPAIGN_COLORS.length]
}
