import {
  db,
  type Procurement,
  type ProcurementItem,
} from '../db/database'
import { calculateSuggestedSellingPrice } from '../utils/pricing'

export interface ProcurementItemInput {
  productId: string
  quantity: number
  totalCost: number
  appliedSellingPrice?: number
}

export interface ProcurementInput {
  supplierId: string
  procurementDate: string
  items: ProcurementItemInput[]
}

export interface LatestValidProcurementForProduct {
  procurement: Procurement
  item: ProcurementItem
}

export function calculateProcurementValues(
  quantity: number,
  totalCost: number,
) {
  const unitCost = totalCost / quantity
  const suggestedSellingPrice =
    calculateSuggestedSellingPrice(unitCost)

  return {
    unitCost,
    suggestedSellingPrice,
  }
}

export function validateProcurementInput(
  input: ProcurementInput,
) {
  if (!input.supplierId) {
    throw new Error('Supplier is required.')
  }

  if (!input.procurementDate) {
    throw new Error('Procurement date is required.')
  }

  if (input.items.length === 0) {
    throw new Error(
      'At least one product is required for the procurement.',
    )
  }

  const productIds = new Set<string>()

  for (const item of input.items) {
    if (!item.productId) {
      throw new Error('Product is required.')
    }

    if (productIds.has(item.productId)) {
      throw new Error(
        'The same product cannot be added more than once to a procurement.',
      )
    }

    productIds.add(item.productId)

    if (item.quantity <= 0) {
      throw new Error(
        'Quantity must be greater than zero.',
      )
    }

    if (item.totalCost <= 0) {
      throw new Error(
        'Total cost must be greater than zero.',
      )
    }

    if (
      item.appliedSellingPrice !== undefined &&
      item.appliedSellingPrice <= 0
    ) {
      throw new Error(
        'Selling price must be greater than zero.',
      )
    }
  }
}

export async function findPotentialDuplicateProcurement(
  input: ProcurementInput,
) {
  if (
    !input.supplierId ||
    !input.procurementDate ||
    input.items.length === 0
  ) {
    return undefined
  }

  const candidateHeaders = await db.procurements
    .where('procurementDate')
    .equals(input.procurementDate)
    .and(
      (procurement) =>
        procurement.supplierId === input.supplierId &&
        procurement.status === 'VALID',
    )
    .toArray()

  const incomingTotal = input.items.reduce(
    (total, item) => total + item.totalCost,
    0,
  )

  for (const procurement of candidateHeaders) {
    const existingItems = await db.procurementItems
      .where('procurementId')
      .equals(procurement.id)
      .toArray()

    if (existingItems.length !== input.items.length) {
      continue
    }

    const existingTotal = existingItems.reduce(
      (total, item) => total + item.totalCost,
      0,
    )

    if (existingTotal === incomingTotal) {
      return procurement
    }
  }

  return undefined
}

export async function getLatestValidProcurementForProduct(
  productId: string,
): Promise<LatestValidProcurementForProduct | undefined> {
  if (!productId) {
    return undefined
  }

  const productItems = await db.procurementItems
    .where('productId')
    .equals(productId)
    .toArray()

  if (productItems.length === 0) {
    return undefined
  }

  const matches: LatestValidProcurementForProduct[] = []

  for (const item of productItems) {
    const procurement = await db.procurements.get(
      item.procurementId,
    )

    if (!procurement || procurement.status !== 'VALID') {
      continue
    }

    matches.push({
      procurement,
      item,
    })
  }

  if (matches.length === 0) {
    return undefined
  }

  matches.sort((a, b) => {
    const dateComparison =
      b.procurement.procurementDate.localeCompare(
        a.procurement.procurementDate,
      )

    if (dateComparison !== 0) {
      return dateComparison
    }

    return b.procurement.createdAt.localeCompare(
      a.procurement.createdAt,
    )
  })

  return matches[0]
}

export async function createProcurement(
  input: ProcurementInput,
) {
  validateProcurementInput(input)

  const procurementId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await db.transaction(
    'rw',
    db.procurements,
    db.procurementItems,
    db.inventoryMovements,
    db.products,
    db.priceHistory,
    async () => {
      const preparedItems = []

      for (const itemInput of input.items) {
        const product = await db.products.get(
          itemInput.productId,
        )

        if (!product) {
          throw new Error(
            'A product linked to this procurement was not found.',
          )
        }

        const {
          unitCost,
          suggestedSellingPrice,
        } = calculateProcurementValues(
          itemInput.quantity,
          itemInput.totalCost,
        )

        const appliedSellingPrice =
          itemInput.appliedSellingPrice ??
          product.sellingPrice

        if (appliedSellingPrice <= 0) {
          throw new Error(
            'Selling price must be greater than zero.',
          )
        }

        preparedItems.push({
          itemInput,
          product,
          unitCost,
          suggestedSellingPrice,
          appliedSellingPrice,
        })
      }

      await db.procurements.add({
        id: procurementId,
        supplierId: input.supplierId,
        procurementDate: input.procurementDate,
        status: 'VALID',
        createdAt,
      })

      for (const prepared of preparedItems) {
        const {
          itemInput,
          product,
          unitCost,
          suggestedSellingPrice,
          appliedSellingPrice,
        } = prepared

        const procurementItemId = crypto.randomUUID()

        await db.procurementItems.add({
          id: procurementItemId,
          procurementId,
          productId: itemInput.productId,
          quantity: itemInput.quantity,
          totalCost: itemInput.totalCost,
          unitCost,
          markupRate: 0.25,
          previousSellingPrice: product.sellingPrice,
          suggestedSellingPrice,
          appliedSellingPrice,
        })

        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          productId: itemInput.productId,
          type: 'RESTOCK',
          quantityDelta: itemInput.quantity,
          referenceId: procurementItemId,
          reason: 'Procurement',
          createdAt,
        })

        const priceChanged =
          appliedSellingPrice !== product.sellingPrice

        await db.products.update(itemInput.productId, {
          currentStockCache:
            product.currentStockCache +
            itemInput.quantity,
          sellingPrice: appliedSellingPrice,
          updatedAt: createdAt,
        })

        if (priceChanged) {
          await db.priceHistory.add({
            id: crypto.randomUUID(),
            productId: itemInput.productId,
            previousPrice: product.sellingPrice,
            newPrice: appliedSellingPrice,
            procurementId,
            reason: 'Procurement price review',
            changedAt: createdAt,
          })
        }
      }
    },
  )

  return procurementId
}

export async function voidProcurement(
  procurementId: string,
  reason: string,
) {
  const trimmedReason = reason.trim()

  if (!trimmedReason) {
    throw new Error('Void reason is required.')
  }

  await db.transaction(
    'rw',
    db.procurements,
    db.procurementItems,
    db.products,
    db.inventoryMovements,
    async () => {
      const procurement = await db.procurements.get(
        procurementId,
      )

      if (!procurement) {
        throw new Error(
          'Procurement record was not found.',
        )
      }

      if (procurement.status === 'VOID') {
        throw new Error(
          'This procurement has already been voided.',
        )
      }

      const items = await db.procurementItems
        .where('procurementId')
        .equals(procurementId)
        .toArray()

      if (items.length === 0) {
        throw new Error(
          'No product items were found for this procurement.',
        )
      }

      const stockUpdates: Array<{
        item: ProcurementItem
        newStock: number
      }> = []

      for (const item of items) {
        const product = await db.products.get(
          item.productId,
        )

        if (!product) {
          throw new Error(
            'A product linked to this procurement was not found.',
          )
        }

        const newStock =
          product.currentStockCache - item.quantity

        if (newStock < 0) {
          throw new Error(
            'This procurement cannot be voided because it would make current stock negative.',
          )
        }

        stockUpdates.push({
          item,
          newStock,
        })
      }

      const voidedAt = new Date().toISOString()

      for (const update of stockUpdates) {
        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          productId: update.item.productId,
          type: 'VOID',
          quantityDelta: -update.item.quantity,
          referenceId: update.item.id,
          reason: trimmedReason,
          createdAt: voidedAt,
        })

        await db.products.update(
          update.item.productId,
          {
            currentStockCache: update.newStock,
            updatedAt: voidedAt,
          },
        )
      }

      await db.procurements.update(procurementId, {
        status: 'VOID',
        voidedAt,
        voidReason: trimmedReason,
      })
    },
  )
}