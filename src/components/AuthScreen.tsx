import { useState } from "react"
import { messageOf } from "../lib/text.ts"
import { useApp } from "../state/AppState.tsx"
import { Mark } from "./Mark.tsx"
import { fieldClass, primaryClass, quietClass } from "./styles.ts"

export function AuthScreen() {
  const { signIn, signUp } = useApp()
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Mark className="size-12 text-gold" />
        <h1 className="mt-6 font-serif text-5xl leading-none font-medium">DM Table</h1>
        <p className="mt-4 text-sm text-muted">Sign in so a campaign can follow you from the laptop to the tablet.</p>
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const nextEmail = email.trim().toLowerCase()
            if (!nextEmail || !password) return
            setBusy(true)
            setError(null)
            setNotice(null)
            const action =
              mode === "sign-in"
                ? signIn(nextEmail, password)
                : signUp(nextEmail, password).then((result) => {
                    if (result.needsConfirmation) {
                      setNotice("Check your email to confirm the account, then sign in.")
                      setMode("sign-in")
                    }
                  })
            void action.catch((caught: unknown) => setError(messageOf(caught))).finally(() => setBusy(false))
          }}
        >
          <label className="text-sm text-muted" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            required
            className={fieldClass}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="text-sm text-muted" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            required
            minLength={6}
            className={fieldClass}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "create" && <p className="text-xs text-faint">At least 6 characters.</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-cream">{notice}</p>}
          <button type="submit" className={primaryClass} disabled={busy}>
            {busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          className={`${quietClass} mt-3 w-full`}
          onClick={() => {
            setMode((current) => (current === "sign-in" ? "create" : "sign-in"))
            setError(null)
            setNotice(null)
          }}
        >
          {mode === "sign-in" ? "Create an account" : "I already have an account"}
        </button>
      </div>
    </div>
  )
}
