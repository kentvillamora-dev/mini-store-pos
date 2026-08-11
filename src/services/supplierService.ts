import { db } from '../db/database'

export async function createSupplier(name: string) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('Supplier name is required.')
  }

  const now = new Date().toISOString()

  await db.suppliers.add({
    id: crypto.randomUUID(),
    name: trimmedName,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
}