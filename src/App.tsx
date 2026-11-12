import { AppShell } from "./components/AppShell.tsx"
import { AuthScreen } from "./components/AuthScreen.tsx"
import { Mark } from "./components/Mark.tsx"
import { AppProvider, useApp } from "./state/AppState.tsx"

function Gate() {
  const { status } = useApp()
  if (status === "loading") {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3 text-gold">
          <Mark className="size-12" />
          <p className="text-xs tracking-[0.18em] text-muted uppercase">DM Table</p>
        </div>
      </div>
    )
  }
  if (status === "signedOut") return <AuthScreen />
  return <AppShell />
}

export default function App() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  )
}
