import { mkdir, readFile, writeFile } from 'node:fs/promises'

const REVIEW_PATH = 'data/photo-review-queue.json'

export async function addPhotoReviewItem(item) {
  await mkdir('data', { recursive: true })
  const existing = await readJson(REVIEW_PATH, [])
  const key = item.sourceUrl || item.name || JSON.stringify(item)
  const filtered = existing.filter((entry) => (entry.sourceUrl || entry.name || JSON.stringify(entry)) !== key)
  filtered.push({ queuedAt: new Date().toISOString(), ...item })
  await writeFile(REVIEW_PATH, `${JSON.stringify(filtered, null, 2)}\n`)
  return filtered.at(-1)
}

export async function readPhotoReviewQueue() {
  return readJson(REVIEW_PATH, [])
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}
