import { Ellipsis, LogOut, Plus } from "lucide-react"
import { useRef, useState, type CSSProperties } from "react"
import { nextCampaignColor } from "../lib/colors.ts"
import { cx } from "../lib/cx.ts"
import { messageOf } from "../lib/text.ts"
import type { Campaign } from "../lib/types.ts"
import { useDismiss } from "../lib/useDismiss.ts"
import { useApp } from "../state/AppState.tsx"
import { ColorSwatches } from "./ColorSwatches.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { FloatingMenu, placeMenu } from "./FloatingMenu.tsx"
import { fieldClass, primaryClass } from "./styles.ts"

export function CampaignBar() {
  const { campaigns } = useApp()
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-end border-b border-line px-2">
      <div role="tablist" aria-label="Campaigns" className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto px-2">
        {campaigns.map((campaign) => (
          <CampaignTab key={campaign.id} campaign={campaign} />
        ))}
        <AddCampaign />
      </div>
      <AccountSlot />
    </header>
  )
}

function CampaignTab({ campaign }: { campaign: Campaign }) {
  const { activeCampaignId, selectCampaign, updateCampaign, deleteCampaign } = useApp()
  const active = campaign.id === activeCampaignId
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(campaign.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { ref: menuRef, menuId } = useDismiss(menuOpen, () => setMenuOpen(false))
  const optionsRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  function commitName() {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== campaign.name) void updateCampaign(campaign.id, { name: next })
    else setDraft(campaign.name)
  }

  return (
    <div
      className={cx(
        "group relative flex h-10 shrink-0 items-center rounded-t-lg border",
        active ? "-mb-px border-line border-b-ink bg-ink text-cream" : "border-transparent text-muted hover:text-cream",
      )}
      style={active ? { boxShadow: `inset 0 2px 0 ${campaign.color}` } : undefined}
    >
      <span className="ml-2.5 size-2 shrink-0 rounded-full" style={{ background: campaign.color }} />
      {editing ? (
        <input
          autoFocus
          data-escape-lock=""
          value={draft}
          aria-label="Campaign name"
          className="mx-1 w-32 bg-transparent text-sm text-cream outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitName()
            }
            if (event.key === "Escape") {
              event.stopPropagation()
              setDraft(campaign.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          role="tab"
          aria-selected={active}
          className="max-w-40 truncate px-2 text-sm"
          onClick={() => selectCampaign(campaign.id)}
          onDoubleClick={() => {
            selectCampaign(campaign.id)
            setDraft(campaign.name)
            setEditing(true)
          }}
        >
          {campaign.name}
        </button>
      )}
      <div className="relative" ref={menuRef}>
        <button
          ref={optionsRef}
          type="button"
          aria-label={`Options for ${campaign.name}`}
          className="mr-1 rounded p-1 text-faint hover:text-cream"
          onClick={() => {
            if (optionsRef.current) setMenuStyle(placeMenu(optionsRef.current, 224, "right"))
            selectCampaign(campaign.id)
            setMenuOpen((open) => !open)
          }}
        >
          <Ellipsis size={14} />
        </button>
        {menuOpen && (
          <FloatingMenu menuId={menuId} style={menuStyle}>
          <div role="menu" className="rounded-xl border border-line bg-raised p-2 shadow-[0_16px_40px_rgb(0_0_0/0.35)]">
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-white/5 hover:text-cream"
              onClick={() => {
                setDraft(campaign.name)
                setEditing(true)
                setMenuOpen(false)
              }}
            >
              Rename
            </button>
            <div className="px-2 py-2">
              <p className="kicker mb-2">Color</p>
              <ColorSwatches value={campaign.color} onChange={(color) => void updateCampaign(campaign.id, { color })} />
            </div>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-white/5 hover:text-danger"
              onClick={() => {
                setMenuOpen(false)
                setConfirming(true)
              }}
            >
              Delete campaign
            </button>
          </div>
          </FloatingMenu>
        )}
        {confirming && (
          <ConfirmDialog
            title="Delete this campaign?"
            message={`“${campaign.name}” and everything in it will be removed.`}
            confirmLabel="Delete campaign"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false)
              void deleteCampaign(campaign.id)
            }}
          />
        )}
      </div>
    </div>
  )
}

function AddCampaign() {
  const { campaigns, createCampaign } = useApp()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(() => nextCampaignColor([]))
  const [error, setError] = useState<string | null>(null)
  const { ref, menuId } = useDismiss(open, () => setOpen(false))
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  return (
    <div className="relative mb-1 self-center" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add campaign"
        title="Add campaign"
        className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-cream"
        onClick={() => {
          if (buttonRef.current) setMenuStyle(placeMenu(buttonRef.current, 256, "left"))
          setColor(nextCampaignColor(campaigns.map((campaign) => campaign.color)))
          setOpen((current) => !current)
        }}
      >
        <Plus size={16} />
      </button>
      {open && (
        <FloatingMenu menuId={menuId} style={menuStyle}>
        <form
          className="rounded-xl border border-line bg-raised p-3 shadow-[0_16px_40px_rgb(0_0_0/0.35)]"
          onSubmit={(event) => {
            event.preventDefault()
            const next = name.trim()
            if (!next) return
            void createCampaign(next, color)
              .then(() => {
                setName("")
                setOpen(false)
              })
              .catch((caught: unknown) => setError(messageOf(caught)))
          }}
        >
          <label className="kicker" htmlFor="new-campaign">
            New campaign
          </label>
          <input
            id="new-campaign"
            autoFocus
            data-escape-lock=""
            value={name}
            placeholder="Campaign name"
            className={`${fieldClass} mt-2`}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="mt-3">
            <ColorSwatches value={color} onChange={setColor} />
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button type="submit" className={`${primaryClass} mt-3 w-full`} disabled={!name.trim()}>
            Create
          </button>
        </form>
        </FloatingMenu>
      )}
    </div>
  )
}

function AccountSlot() {
  const { mode, email, signOut } = useApp()
  const [open, setOpen] = useState(false)
  const { ref } = useDismiss(open, () => setOpen(false))

  if (mode === "local") {
    return (
      <div className="relative mb-2 ml-2" ref={ref}>
        <button type="button" className="rounded-md px-2 py-1 text-xs tracking-wide text-faint uppercase hover:text-cream" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          This device
        </button>
        {open && (
          <div className="absolute top-full right-0 z-40 mt-2 w-72 rounded-xl border border-line bg-raised p-3 text-sm text-muted shadow-[0_16px_40px_rgb(0_0_0/0.35)]">
            Campaigns are saved in this browser. Add a Supabase URL and anon key in <span className="text-cream">.env</span> when you want the laptop and tablet to share one account.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-2 ml-2 flex items-center gap-1">
      <span className="max-w-40 truncate text-xs text-muted" title={email ?? undefined}>
        {email}
      </span>
      <button type="button" aria-label="Sign out" className="rounded-md p-1.5 text-muted hover:text-cream" onClick={() => void signOut()}>
        <LogOut size={15} />
      </button>
    </div>
  )
}
