import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createRepository } from "../lib/create-repository.ts"
import type { Repository } from "../lib/repository.ts"
import { isSectionId } from "../lib/sections.ts"
import { emptyDoc, messageOf } from "../lib/text.ts"
import type {
  Campaign,
  CampaignPatch,
  Entry,
  EntryLink,
  EntryPatch,
  ListItem,
  PanelSectionId,
  PcSheet,
  PcSheetPatch,
  PlotSubsection,
  PlotSubsectionPatch,
  SectionId,
  StoryItem,
  StoryItemPatch,
} from "../lib/types.ts"

const CAMPAIGN_KEY = "dm-table:campaign"
const SECTION_KEY = "dm-table:section"

type Status = "loading" | "signedOut" | "ready"

type AppContextValue = {
  status: Status
  mode: Repository["mode"]
  email: string | null
  error: string | null
  dismissError: () => void
  campaigns: Campaign[]
  entries: Entry[]
  links: EntryLink[]
  listItems: ListItem[]
  plotSubsections: PlotSubsection[]
  storyItems: StoryItem[]
  pcSheets: PcSheet[]
  campaignsLoaded: boolean
  entriesLoadedFor: string | null
  activeCampaignId: string | null
  activeSection: SectionId
  activeEntryId: string | null
  campaign: Campaign | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  selectCampaign: (id: string) => void
  createCampaign: (name: string, color: string) => Promise<void>
  updateCampaign: (id: string, patch: CampaignPatch) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  selectSection: (section: SectionId) => void
  selectEntry: (id: string | null) => void
  openEntry: (entry: Entry) => void
  createEntry: (input: { section: PanelSectionId; name: string; subsection: string }) => Promise<Entry>
  updateEntry: (id: string, patch: EntryPatch) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  createItem: (input: { entryId: string; listKey: string; label: string; linkedEntryId: string | null }) => Promise<void>
  updateItem: (id: string, patch: { label?: string; linkedEntryId?: string | null }) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  createLink: (targetEntryId: string) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  createPlotSubsection: (name: string) => Promise<PlotSubsection>
  updatePlotSubsection: (id: string, patch: PlotSubsectionPatch) => Promise<void>
  deletePlotSubsection: (id: string) => Promise<void>
  createStoryItem: (input: { subsectionId: string; kind: StoryItem["kind"]; name: string; sessionDate: string | null }) => Promise<StoryItem>
  updateStoryItem: (id: string, patch: StoryItemPatch) => Promise<void>
  deleteStoryItem: (id: string) => Promise<void>
  ensurePcSheet: (entryId: string) => Promise<void>
  updatePcSheet: (entryId: string, recipe: (sheet: PcSheet) => PcSheetPatch) => Promise<void>
  uploadImage: (file: File) => Promise<string>
  imageUrl: (path: string) => Promise<string | null>
  deleteStoredImage: (path: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createRepository(), [])
  const [status, setStatus] = useState<Status>("loading")
  const [email, setEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [links, setLinks] = useState<EntryLink[]>([])
  const [listItems, setListItems] = useState<ListItem[]>([])
  const [plotSubsections, setPlotSubsections] = useState<PlotSubsection[]>([])
  const [storyItems, setStoryItems] = useState<StoryItem[]>([])
  const pcSheetsRef = useRef<PcSheet[]>([])
  const [pcSheets, setPcSheetsState] = useState<PcSheet[]>([])
  const setPcSheets = useCallback((update: PcSheet[] | ((current: PcSheet[]) => PcSheet[])) => {
    const next = typeof update === "function" ? update(pcSheetsRef.current) : update
    pcSheetsRef.current = next
    setPcSheetsState(next)
  }, [])
  const [campaignsLoaded, setCampaignsLoaded] = useState(false)
  const [entriesLoadedFor, setEntriesLoadedFor] = useState<string | null>(null)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    const stored = localStorage.getItem(SECTION_KEY)
    return isSectionId(stored) ? stored : "home"
  })
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const campaignIdRef = useRef(activeCampaignId)
  campaignIdRef.current = activeCampaignId
  const queues = useRef(new Map<string, Promise<void>>())

  const queue = useCallback((key: string, task: () => Promise<void>) => {
    const previous = queues.current.get(key) ?? Promise.resolve()
    const next = previous.then(task, task)
    queues.current.set(key, next)
    return next
  }, [])

  const report = useCallback((caught: unknown) => {
    setError(messageOf(caught))
  }, [])

  useEffect(() => {
    return repo.onAuthChange((session) => {
      setEmail(session?.email ?? null)
      setAuthReady(true)
    })
  }, [repo])

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(null), 6000)
    return () => window.clearTimeout(timer)
  }, [error])

  useEffect(() => {
    if (!authReady) return
    if (repo.mode === "supabase" && !email) {
      setStatus("signedOut")
      setCampaigns([])
      setEntries([])
      setLinks([])
      setListItems([])
      setPlotSubsections([])
      setStoryItems([])
      setPcSheets([])
      setCampaignsLoaded(false)
      setActiveCampaignId(null)
      return
    }

    let cancelled = false
    void repo
      .listCampaigns()
      .then((rows) => {
        if (cancelled) return
        setCampaigns(rows)
        setActiveCampaignId((current) => {
          if (current && rows.some((row) => row.id === current)) return current
          const stored = localStorage.getItem(CAMPAIGN_KEY)
          if (stored && rows.some((row) => row.id === stored)) return stored
          return rows[0]?.id ?? null
        })
        setCampaignsLoaded(true)
        setStatus("ready")
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        report(caught)
        setCampaignsLoaded(true)
        setStatus("ready")
      })
    return () => {
      cancelled = true
    }
  }, [authReady, email, repo, report, setPcSheets])

  useEffect(() => {
    if (status !== "ready" || !activeCampaignId) {
      if (!activeCampaignId) {
        setEntries([])
        setLinks([])
        setPlotSubsections([])
        setStoryItems([])
        setPcSheets([])
        setEntriesLoadedFor(null)
      }
      return
    }

    let cancelled = false
    const campaignId = activeCampaignId
    setEntriesLoadedFor(null)
    setPlotSubsections([])
    setStoryItems([])
    setPcSheets([])
    void Promise.all([
      repo.listEntries(campaignId),
      repo.listLinks(campaignId),
      repo.listPlotSubsections(campaignId),
      repo.listStoryItems(campaignId),
      repo.listPcSheets(campaignId),
    ])
      .then(([nextEntries, nextLinks, nextSubsections, nextStories, nextSheets]) => {
        if (cancelled) return
        setEntries((current) => {
          const extras = current.filter(
            (entry) => entry.campaignId === campaignId && !nextEntries.some((item) => item.id === entry.id),
          )
          return [...nextEntries, ...extras]
        })
        setLinks((current) => {
          const extras = current.filter(
            (link) => link.campaignId === campaignId && !nextLinks.some((item) => item.id === link.id),
          )
          return [...nextLinks, ...extras]
        })
        setPlotSubsections((current) => {
          const extras = current.filter(
            (item) => item.campaignId === campaignId && !nextSubsections.some((row) => row.id === item.id),
          )
          return [...nextSubsections, ...extras]
        })
        setStoryItems((current) => {
          const extras = current.filter(
            (item) => item.campaignId === campaignId && !nextStories.some((row) => row.id === item.id),
          )
          return [...nextStories, ...extras]
        })
        setPcSheets((current) => {
          const extras = current.filter(
            (sheet) => sheet.campaignId === campaignId && !nextSheets.some((row) => row.entryId === sheet.entryId),
          )
          return [...nextSheets, ...extras]
        })
        setEntriesLoadedFor(campaignId)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        report(caught)
        setEntriesLoadedFor(campaignId)
      })
    return () => {
      cancelled = true
    }
  }, [status, activeCampaignId, repo, report, setPcSheets])

  useEffect(() => {
    setActiveEntryId(null)
    setListItems([])
  }, [activeCampaignId])

  useEffect(() => {
    if (!activeEntryId) {
      setListItems([])
      return
    }
    let cancelled = false
    const entryId = activeEntryId
    void repo
      .listItems(entryId)
      .then((rows) => {
        if (!cancelled) setListItems(rows)
      })
      .catch((caught: unknown) => {
        if (!cancelled) report(caught)
      })
    return () => {
      cancelled = true
    }
  }, [activeEntryId, repo, report])

  useEffect(() => {
    if (activeCampaignId) localStorage.setItem(CAMPAIGN_KEY, activeCampaignId)
  }, [activeCampaignId])

  useEffect(() => {
    localStorage.setItem(SECTION_KEY, activeSection)
  }, [activeSection])

  const signIn = useCallback(
    async (nextEmail: string, password: string) => {
      setError(null)
      await repo.signIn(nextEmail, password)
    },
    [repo],
  )

  const signUp = useCallback(
    async (nextEmail: string, password: string) => {
      setError(null)
      return repo.signUp(nextEmail, password)
    },
    [repo],
  )

  const signOut = useCallback(async () => {
    await repo.signOut()
  }, [repo])

  const selectCampaign = useCallback((id: string) => {
    setActiveCampaignId(id)
  }, [])

  const createCampaign = useCallback(
    async (name: string, color: string) => {
      const campaign = await repo.createCampaign(name, color)
      setCampaigns((current) => [...current, campaign])
      setActiveCampaignId(campaign.id)
      setCampaignsLoaded(true)
    },
    [repo],
  )

  const updateCampaign = useCallback(
    async (id: string, patch: CampaignPatch) => {
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === id ? { ...campaign, ...patch, updatedAt: new Date().toISOString() } : campaign,
        ),
      )
      try {
        await queue(`campaign:${id}`, () => repo.updateCampaign(id, patch))
      } catch (caught) {
        report(caught)
      }
    },
    [queue, repo, report],
  )

  const deleteCampaign = useCallback(
    async (id: string) => {
      try {
        await repo.deleteCampaign(id)
        setCampaigns((current) => current.filter((campaign) => campaign.id !== id))
        setActiveCampaignId((current) => {
          if (current !== id) return current
          const remaining = campaigns.filter((campaign) => campaign.id !== id)
          return remaining[0]?.id ?? null
        })
      } catch (caught) {
        report(caught)
      }
    },
    [campaigns, repo, report],
  )

  const selectSection = useCallback((section: SectionId) => {
    setActiveSection(section)
    setActiveEntryId(null)
  }, [])

  const selectEntry = useCallback((id: string | null) => {
    setActiveEntryId(id)
  }, [])

  const openEntry = useCallback((entry: Entry) => {
    setActiveSection(entry.section)
    setActiveEntryId(entry.id)
  }, [])

  const createEntry = useCallback(
    async (input: { section: PanelSectionId; name: string; subsection: string }) => {
      if (!activeCampaignId) throw new Error("Choose a campaign first.")
      const entry = await repo.createEntry({
        campaignId: activeCampaignId,
        section: input.section,
        name: input.name,
        subsection: input.subsection,
        body: emptyDoc(),
      })
      setEntries((current) => [...current, entry])
      if (entry.section === "pcs") {
        const sheet = await repo.createPcSheet(entry.id)
        if (campaignIdRef.current === entry.campaignId) {
          setPcSheets((current) => (current.some((item) => item.entryId === sheet.entryId) ? current : [...current, sheet]))
        }
      }
      setEntriesLoadedFor(activeCampaignId)
      return entry
    },
    [activeCampaignId, repo, setPcSheets],
  )

  const updateEntry = useCallback(
    async (id: string, patch: EntryPatch) => {
      setEntries((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry)),
      )
      try {
        await queue(`entry:${id}`, () => repo.updateEntry(id, patch))
      } catch (caught) {
        report(caught)
        const campaignId = campaignIdRef.current
        if (!campaignId) return
        const fresh = await repo.listEntries(campaignId).catch(() => null)
        if (fresh) setEntries(fresh)
      }
    },
    [queue, repo, report],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      try {
        await repo.deleteEntry(id)
        setEntries((current) => current.filter((entry) => entry.id !== id))
        setLinks((current) => current.filter((link) => link.sourceEntryId !== id && link.targetEntryId !== id))
        setListItems((current) =>
          current
            .filter((item) => item.entryId !== id)
            .map((item) => (item.linkedEntryId === id ? { ...item, linkedEntryId: null } : item)),
        )
        setPcSheets((current) => current.filter((sheet) => sheet.entryId !== id))
        setActiveEntryId((current) => (current === id ? null : current))
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report, setPcSheets],
  )

  const createItem = useCallback(
    async (input: { entryId: string; listKey: string; label: string; linkedEntryId: string | null }) => {
      const item = await repo.createItem(input)
      setListItems((current) => [...current, item])
    },
    [repo],
  )

  const updateItem = useCallback(
    async (id: string, patch: { label?: string; linkedEntryId?: string | null }) => {
      setListItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
      try {
        await repo.updateItem(id, patch)
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setListItems((current) => current.filter((item) => item.id !== id))
      try {
        await repo.deleteItem(id)
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report],
  )

  const createLink = useCallback(
    async (targetEntryId: string) => {
      if (!activeCampaignId || !activeEntryId || targetEntryId === activeEntryId) return
      try {
        const link = await repo.createLink({
          campaignId: activeCampaignId,
          sourceEntryId: activeEntryId,
          targetEntryId,
        })
        setLinks((current) => [...current, link])
      } catch (caught) {
        report(caught)
      }
    },
    [activeCampaignId, activeEntryId, repo, report],
  )

  const deleteLink = useCallback(
    async (id: string) => {
      setLinks((current) => current.filter((link) => link.id !== id))
      try {
        await repo.deleteLink(id)
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report],
  )

  const createPlotSubsection = useCallback(
    async (name: string) => {
      if (!activeCampaignId) throw new Error("Choose a campaign first.")
      const subsection = await repo.createPlotSubsection(activeCampaignId, name)
      setPlotSubsections((current) => [...current, subsection])
      setEntriesLoadedFor(activeCampaignId)
      return subsection
    },
    [activeCampaignId, repo],
  )

  const updatePlotSubsection = useCallback(
    async (id: string, patch: PlotSubsectionPatch) => {
      setPlotSubsections((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)),
      )
      try {
        await queue(`plot:${id}`, () => repo.updatePlotSubsection(id, patch))
      } catch (caught) {
        report(caught)
      }
    },
    [queue, repo, report],
  )

  const deletePlotSubsection = useCallback(
    async (id: string) => {
      try {
        await repo.deletePlotSubsection(id)
        setPlotSubsections((current) => current.filter((item) => item.id !== id))
        setStoryItems((current) => current.filter((item) => item.subsectionId !== id))
        setActiveEntryId((current) => {
          const removed = storyItems.some((item) => item.id === current && item.subsectionId === id)
          return removed ? null : current
        })
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report, storyItems],
  )

  const createStoryItem = useCallback(
    async (input: { subsectionId: string; kind: StoryItem["kind"]; name: string; sessionDate: string | null }) => {
      if (!activeCampaignId) throw new Error("Choose a campaign first.")
      const item = await repo.createStoryItem({
        campaignId: activeCampaignId,
        subsectionId: input.subsectionId,
        kind: input.kind,
        name: input.name,
        sessionDate: input.sessionDate,
      })
      setStoryItems((current) => [...current, item])
      setEntriesLoadedFor(activeCampaignId)
      return item
    },
    [activeCampaignId, repo],
  )

  const updateStoryItem = useCallback(
    async (id: string, patch: StoryItemPatch) => {
      setStoryItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)),
      )
      try {
        await queue(`story:${id}`, () => repo.updateStoryItem(id, patch))
      } catch (caught) {
        report(caught)
      }
    },
    [queue, repo, report],
  )

  const deleteStoryItem = useCallback(
    async (id: string) => {
      try {
        await repo.deleteStoryItem(id)
        setStoryItems((current) => current.filter((item) => item.id !== id))
        setActiveEntryId((current) => (current === id ? null : current))
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report],
  )

  const ensurePcSheet = useCallback(
    async (entryId: string) => {
      try {
        const sheet = await repo.createPcSheet(entryId)
        if (campaignIdRef.current !== sheet.campaignId) return
        setPcSheets((current) => (current.some((item) => item.entryId === sheet.entryId) ? current : [...current, sheet]))
      } catch (caught) {
        report(caught)
      }
    },
    [repo, report, setPcSheets],
  )

  const updatePcSheet = useCallback(
    async (entryId: string, recipe: (sheet: PcSheet) => PcSheetPatch) => {
      const current = pcSheetsRef.current.find((sheet) => sheet.entryId === entryId)
      if (!current) return
      const patch = recipe(current)
      if (Object.keys(patch).length === 0) return
      const updatedAt = new Date().toISOString()
      const nextSheet = { ...current, ...patch, updatedAt }
      setPcSheets((sheets) => sheets.map((sheet) => (sheet.entryId === entryId ? nextSheet : sheet)))
      setEntries((rows) => rows.map((entry) => (entry.id === entryId ? { ...entry, updatedAt } : entry)))
      try {
        await queue(`pc:${entryId}`, () => repo.updatePcSheet(entryId, patch))
      } catch (caught) {
        report(caught)
      }
    },
    [queue, repo, report, setPcSheets],
  )

  const uploadImage = useCallback(
    async (file: File) => {
      if (!activeCampaignId) throw new Error("Choose a campaign first.")
      return repo.uploadImage(activeCampaignId, file)
    },
    [activeCampaignId, repo],
  )

  const imageUrl = useCallback((path: string) => repo.imageUrl(path), [repo])
  const deleteStoredImage = useCallback((path: string) => repo.deleteImage(path), [repo])

  const campaign = campaigns.find((item) => item.id === activeCampaignId) ?? null

  const value: AppContextValue = {
    status,
    mode: repo.mode,
    email,
    error,
    dismissError: () => setError(null),
    campaigns,
    entries,
    links,
    listItems,
    plotSubsections,
    storyItems,
    pcSheets,
    campaignsLoaded,
    entriesLoadedFor,
    activeCampaignId,
    activeSection,
    activeEntryId,
    campaign,
    signIn,
    signUp,
    signOut,
    selectCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    selectSection,
    selectEntry,
    openEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    createItem,
    updateItem,
    deleteItem,
    createLink,
    deleteLink,
    createPlotSubsection,
    updatePlotSubsection,
    deletePlotSubsection,
    createStoryItem,
    updateStoryItem,
    deleteStoryItem,
    ensurePcSheet,
    updatePcSheet,
    uploadImage,
    imageUrl,
    deleteStoredImage,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used inside AppProvider")
  return context
}
