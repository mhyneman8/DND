import { DataError } from "./repository.ts"

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])
const MAX_BYTES = 8 * 1024 * 1024

export function validateImage(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new DataError("Use a PNG, JPEG, WebP, or GIF.")
  }
  if (file.size > MAX_BYTES) {
    throw new DataError("Images need to be 8 MB or smaller.")
  }
}

export function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (fromName && fromName.length <= 5) return fromName
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  if (file.type === "image/gif") return "gif"
  return "jpg"
}

export function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new DataError("Could not read that image."))
    reader.readAsDataURL(file)
  })
}
