import { X } from "lucide-react"
import { useEffect, type CSSProperties } from "react"
import { useApp } from "../state/AppState.tsx"
import { CampaignBar } from "./CampaignBar.tsx"
import { HomeView } from "./HomeView.tsx"
import { SectionPanel } from "./SectionPanel.tsx"
import { Sidebar } from "./Sidebar.tsx"

export function AppShell() {
  const { campaign, activeSection, error, dismissError } = useApp()

  useEffect(() => {
    document.title = campaign ? `${campaign.name} · DM Table` : "DM Table"
  }, [campaign])

  return (
    <div className="shell flex h-dvh flex-col" style={{ "--campaign": campaign?.color ?? "#e0a45a" } as CSSProperties}>
      <CampaignBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1">
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <HomeView />
          </main>
          {activeSection !== "home" && <SectionPanel />}
        </div>
      </div>
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm shadow-xl">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" className="text-muted hover:text-cream" onClick={dismissError}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
