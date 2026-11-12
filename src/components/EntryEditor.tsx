import { useRef, useState } from "react"
import { listMeta, notesPlaceholder } from "../lib/sections.ts"
import { compareNames } from "../lib/text.ts"
import type { Entry, RichDoc } from "../lib/types.ts"
import { useAutosave } from "../lib/useAutosave.ts"
import { useApp } from "../state/AppState.tsx"
import { ConfirmDialog } from "./ConfirmDialog.tsx"
import { EntryLinks } from "./EntryLinks.tsx"
import { ImageUpload } from "./ImageUpload.tsx"
import { NamedList } from "./NamedList.tsx"
import { RichTextField } from "./RichTextField.tsx"
import { fieldClass } from "./styles.ts"

export function EntryEditor({ entry }: { entry: Entry }) {
  return <EntryForm key={entry.id} entry={entry} />
}

function EntryForm({ entry }: { entry: Entry }) {
  const {
    entries,
    links,
    listItems,
    campaign,
    updateEntry,
    deleteEntry,
    uploadImage,
    deleteStoredImage,
    createItem,
    updateItem,
    deleteItem,
    createLink,
    deleteLink,
  } = useApp()
  const meta = listMeta(entry.section)
  const [name, setName] = useState(entry.name)
  const [subsection, setSubsection] = useState(entry.subsection)
  const [confirming, setConfirming] = useState(false)
  const queue = useAutosave(400)
  const nameRef = useRef(name)
  const subsectionRef = useRef(subsection)
  const bodyRef = useRef(entry.body)
  nameRef.current = name
  subsectionRef.current = subsection

  const campaignEntries = entries.filter((item) => item.campaignId === campaign?.id)
  const subsections = [
    ...new Set(
      campaignEntries
        .filter((item) => item.section === entry.section && item.subsection.trim())
        .map((item) => item.subsection.trim()),
    ),
  ].sort(compareNames)
  const items = listItems.filter((item) => item.entryId === entry.id && item.listKey === meta.key)

  function saveDraft(next?: { name?: string; subsection?: string; body?: RichDoc }) {
    if (next?.name !== undefined) nameRef.current = next.name
    if (next?.subsection !== undefined) subsectionRef.current = next.subsection
    if (next?.body !== undefined) bodyRef.current = next.body
    queue(() => {
      const trimmed = nameRef.current.trim()
      if (!trimmed) return
      void updateEntry(entry.id, {
        name: trimmed,
        subsection: subsectionRef.current.trim(),
        body: bodyRef.current,
      })
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <input
        value={name}
        aria-label="Name"
        className={`${fieldClass} font-serif text-xl`}
        onChange={(event) => {
          setName(event.target.value)
          saveDraft({ name: event.target.value })
        }}
      />
      <input
        value={subsection}
        aria-label="Subsection"
        placeholder="Subsection"
        list={`${entry.id}-subsections`}
        className={fieldClass}
        onChange={(event) => {
          setSubsection(event.target.value)
          saveDraft({ subsection: event.target.value })
        }}
      />
      <datalist id={`${entry.id}-subsections`}>
        {subsections.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <ImageUpload
        path={entry.imagePath}
        alt={name || "Entry image"}
        onUpload={async (file) => {
          const path = await uploadImage(file)
          const previous = entry.imagePath
          await updateEntry(entry.id, { imagePath: path })
          if (previous && previous !== path) await deleteStoredImage(previous)
        }}
        onRemove={async () => {
          const previous = entry.imagePath
          await updateEntry(entry.id, { imagePath: null })
          if (previous) await deleteStoredImage(previous)
        }}
      />
      <RichTextField
        initialContent={entry.body}
        ariaLabel="Entry notes"
        placeholder={notesPlaceholder(entry.section)}
        minHeight={160}
        onChange={(body) => saveDraft({ body })}
      />
      <NamedList
        title={meta.title}
        placeholder={meta.placeholder}
        items={items}
        entries={campaignEntries}
        currentEntryId={entry.id}
        onAdd={(label) => createItem({ entryId: entry.id, listKey: meta.key, label, linkedEntryId: null })}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />
      <EntryLinks
        entryId={entry.id}
        entries={campaignEntries}
        links={links.filter((link) => link.campaignId === campaign?.id)}
        onAdd={createLink}
        onRemove={deleteLink}
      />
      <div className="border-t border-line pt-3">
        <button type="button" className="text-sm text-faint hover:text-danger" onClick={() => setConfirming(true)}>
          Delete entry
        </button>
        {confirming && (
          <ConfirmDialog
            title="Delete this entry?"
            message={`“${entry.name}” will be removed from this campaign.`}
            confirmLabel="Delete entry"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false)
              void deleteEntry(entry.id)
            }}
          />
        )}
      </div>
    </div>
  )
}
