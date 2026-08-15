import { db } from '../db/database'

export async function createProduct(
  name: string,
  categoryId: string,
) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('Product name is required.')
  }

  if (!categoryId) {
    throw new Error('Product category is required.')
  }

  const category = await db.categories.get(categoryId)

  if (!category || !category.active) {
    throw new Error('Selected product category is not available.')
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
    categoryId,
    sellingPrice: 0,
    currentStockCache: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateProduct(
  productId: string,
  name: string,
  categoryId: string,
) {
  const trimmedName = name.trim()

  if (!productId) {
    throw new Error('Product is required.')
  }

  if (!trimmedName) {
    throw new Error('Product name is required.')
  }

  if (!categoryId) {
    throw new Error('Product category is required.')
  }

  const product = await db.products.get(productId)

  if (!product) {
    throw new Error('Product was not found.')
  }

  const category = await db.categories.get(categoryId)

  if (!category || !category.active) {
    throw new Error('Selected product category is not available.')
  }

  const existingProducts = await db.products.toArray()

  const duplicateProduct = existingProducts.find(
    (candidate) =>
      candidate.id !== productId &&
      candidate.name.trim().toLocaleLowerCase() ===
        trimmedName.toLocaleLowerCase(),
  )

  if (duplicateProduct) {
    throw new Error('Product name already exists.')
  }

  const now = new Date().toISOString()

  await db.products.update(productId, {
    name: trimmedName,
    categoryId,
    updatedAt: now,
  })
}