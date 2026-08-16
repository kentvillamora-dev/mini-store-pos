import {
  db,
  type InventoryMovement,
  type InventoryReconciliation,
  type InventoryReconciliationItem,
} from '../db/database'

export interface InventoryReconciliationInputItem {
  productId: string
  physicalQuantity: number
}

export interface CreateInventoryReconciliationInput {
  reconciliationDate: string
  reason: string
  note?: string
  items: InventoryReconciliationInputItem[]
}

export interface InventoryReconciliationResult {
  reconciliation: InventoryReconciliation
  items: InventoryReconciliationItem[]
}

function validateReconciliationDate(
  reconciliationDate: string,
) {
  if (!reconciliationDate.trim()) {
    throw new Error(
      'Reconciliation date is required.',
    )
  }

  const parsedDate = new Date(
    `${reconciliationDate}T00:00:00`,
  )

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(
      'Reconciliation date is invalid.',
    )
  }
}

function validateReason(reason: string) {
  if (!reason.trim()) {
    throw new Error(
      'Reconciliation reason is required.',
    )
  }
}

function validateItems(
  items: InventoryReconciliationInputItem[],
) {
  if (items.length === 0) {
    throw new Error(
      'At least one product must be counted.',
    )
  }

  const seenProductIds = new Set<string>()

  for (const item of items) {
    if (!item.productId.trim()) {
      throw new Error(
        'Each counted item must have a product.',
      )
    }

    if (seenProductIds.has(item.productId)) {
      throw new Error(
        'A product may only appear once in a reconciliation.',
      )
    }

    seenProductIds.add(item.productId)

    if (
      !Number.isFinite(item.physicalQuantity) ||
      !Number.isInteger(item.physicalQuantity) ||
      item.physicalQuantity < 0
    ) {
      throw new Error(
        'Physical quantity must be a whole number zero or greater.',
      )
    }
  }
}

export async function createInventoryReconciliation(
  input: CreateInventoryReconciliationInput,
): Promise<InventoryReconciliationResult> {
  validateReconciliationDate(
    input.reconciliationDate,
  )

  validateReason(input.reason)
  validateItems(input.items)

  const trimmedReason = input.reason.trim()
  const trimmedNote =
    input.note?.trim() || undefined

  return db.transaction(
    'rw',
    [
      db.inventoryReconciliations,
      db.inventoryReconciliationItems,
      db.inventoryMovements,
      db.products,
    ],
    async () => {
      const reconciliationId =
        crypto.randomUUID()

      const createdAt =
        new Date().toISOString()

      const reconciliationItems: InventoryReconciliationItem[] =
        []

      const adjustmentMovements: InventoryMovement[] =
        []

      let adjustedItemCount = 0

      for (const inputItem of input.items) {
        const product =
          await db.products.get(
            inputItem.productId,
          )

        if (!product) {
          throw new Error(
            'One of the counted products no longer exists.',
          )
        }

        if (!product.active) {
          throw new Error(
            `${product.name} is inactive and cannot be reconciled.`,
          )
        }

        const expectedQuantity =
          product.currentStockCache

        const variance =
          inputItem.physicalQuantity -
          expectedQuantity

        const reconciliationItemId =
          crypto.randomUUID()

        const reconciliationItem: InventoryReconciliationItem =
          {
            id: reconciliationItemId,
            reconciliationId,
            productId: product.id,
            expectedQuantity,
            physicalQuantity:
              inputItem.physicalQuantity,
            variance,
          }

        reconciliationItems.push(
          reconciliationItem,
        )

        if (variance !== 0) {
          adjustedItemCount += 1

          adjustmentMovements.push({
            id: crypto.randomUUID(),
            productId: product.id,
            type: 'ADJUSTMENT',
            quantityDelta: variance,
            referenceId:
              reconciliationItemId,
            reason: trimmedReason,
            createdAt,
          })

          await db.products.update(
            product.id,
            {
              currentStockCache:
                inputItem.physicalQuantity,
              updatedAt: createdAt,
            },
          )
        }
      }

      const reconciliation: InventoryReconciliation =
        {
          id: reconciliationId,
          reconciliationDate:
            input.reconciliationDate,
          reason: trimmedReason,
          note: trimmedNote,
          countedItemCount:
            reconciliationItems.length,
          adjustedItemCount,
          createdAt,
        }

      await db.inventoryReconciliations.add(
        reconciliation,
      )

      await db.inventoryReconciliationItems.bulkAdd(
        reconciliationItems,
      )

      if (adjustmentMovements.length > 0) {
        await db.inventoryMovements.bulkAdd(
          adjustmentMovements,
        )
      }

      return {
        reconciliation,
        items: reconciliationItems,
      }
    },
  )
}