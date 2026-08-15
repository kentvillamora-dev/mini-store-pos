import { db } from '../db/database'

export async function createProduct(name: string) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('Product name is required.')
  }

  const existingProducts = await db.products.toArray()

  const duplicateProduct = existingProducts.find(
    (product) =>
      product.name.trim().toLocaleLowerCase() ===
      trimmedName.toLocaleLowerCase(),
  )

  if (duplicateProduct) {
    throw new Error('Product name already exists.')
  }

  const now = new Date().toISOString()

  await db.products.add({
    id: crypto.randomUUID(),
    name: trimmedName,
    sellingPrice: 0,
    currentStockCache: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
}
