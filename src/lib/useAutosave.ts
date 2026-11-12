import { useCallback, useEffect, useRef } from "react"

export function useAutosave(delay = 500) {
  const timer = useRef<number | null>(null)
  const dirty = useRef(false)
  const saveRef = useRef<() => void>(() => {})

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      if (dirty.current) saveRef.current()
    }
  }, [])

  return useCallback(
    (save: () => void) => {
      saveRef.current = save
      dirty.current = true
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        dirty.current = false
        save()
      }, delay)
    },
    [delay],
  )
}
