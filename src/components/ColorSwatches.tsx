import { CAMPAIGN_COLORS } from "../lib/colors.ts"
import { cx } from "../lib/cx.ts"

export function ColorSwatches({
  value,
  onChange,
  label = "Campaign color",
}: {
  value: string
  onChange: (color: string) => void
  label?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {CAMPAIGN_COLORS.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className={cx("size-5 rounded-full", selected && "ring-2 ring-cream ring-offset-2 ring-offset-raised")}
            style={{ background: color }}
          />
        )
      })}
    </div>
  )
}
