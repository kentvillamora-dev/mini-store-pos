import { db } from '../db/database'

export interface SetProductPriceInput {
  productId: string
  newPrice: number
  procurementId?: string
  reason?: string
}

export async function setProductPrice(
  input: SetProductPriceInput,
) {
  if (!input.productId) {
    throw new Error('Product is required.')
  }

  if (input.newPrice <= 0) {
    throw new Error('Selling price must be greater than zero.')
  }

  const product = await db.products.get(input.productId)

  if (!product) {
    throw new Error('Product not found.')
  }

  if (product.sellingPrice === input.newPrice) {
    throw new Error(
      'New selling price must be different from the current price.',
    )
  }

  const changedAt = new Date().toISOString()

  await db.transaction(
    'rw',
    db.products,
    db.priceHistory,
    async () => {
      await db.products.update(input.productId, {
        sellingPrice: input.newPrice,
        updatedAt: changedAt,
      })

      await db.priceHistory.add({
        id: crypto.randomUUID(),
        productId: input.productId,
        previousPrice: product.sellingPrice,
        newPrice: input.newPrice,
        procurementId: input.procurementId,
        reason: input.reason?.trim() || undefined,
        changedAt,
      })
    },
  )
}