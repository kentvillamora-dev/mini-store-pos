import {
  db,
  type Procurement,
  type ProcurementItem,
  type ProcurementType,
} from '../db/database'
import { calculateSuggestedSellingPrice } from '../utils/pricing'

export interface ProcurementItemInput {
  productId: string
  quantity: number
  totalCost: number
  appliedSellingPrice?: number
}

export interface ProcurementInput {
  procurementType?: ProcurementType
  supplierId?: string
  procurementDate: string
  items: ProcurementItemInput[]
}

export interface LatestValidProcurementForProduct {
  procurement: Procurement
  item: ProcurementItem
}

export function calculateProcurementValues(quantity: number, totalCost: number) {
  const unitCost = totalCost / quantity
  return {
    unitCost,
    suggestedSellingPrice: calculateSuggestedSellingPrice(unitCost),
  }
}

export function validateProcurementInput(input: ProcurementInput) {
  const procurementType = input.procurementType ?? 'PURCHASE'

  if (procurementType === 'PURCHASE' && !input.supplierId) {
    throw new Error('Supplier is required.')
  }

  if (!input.procurementDate) throw new Error('Procurement date is required.')
  if (input.items.length === 0) {
    throw new Error('At least one product is required for the procurement.')
  }

  const productIds = new Set<string>()

  for (const item of input.items) {
    if (!item.productId) throw new Error('Product is required.')
    if (productIds.has(item.productId)) {
      throw new Error('The same product cannot be added more than once to a procurement.')
    }
    productIds.add(item.productId)

    if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new Error('Quantity must be a whole number greater than zero.')
    }

    if (procurementType === 'PURCHASE' && item.totalCost <= 0) {
      throw new Error('Total cost must be greater than zero.')
    }

    if (procurementType === 'OPENING_INVENTORY' && item.totalCost !== 0) {
      throw new Error('Opening inventory must not include procurement cost.')
    }

    if (item.appliedSellingPrice === undefined || item.appliedSellingPrice <= 0) {
      throw new Error('Selling price must be greater than zero.')
    }
  }
}

export async function findPotentialDuplicateProcurement(input: ProcurementInput) {
  const procurementType = input.procurementType ?? 'PURCHASE'
  if (!input.procurementDate || input.items.length === 0) return undefined
  if (procurementType === 'PURCHASE' && !input.supplierId) return undefined

  const candidateHeaders = await db.procurements
    .where('procurementDate')
    .equals(input.procurementDate)
    .and((procurement) =>
      procurement.status === 'VALID' &&
      (procurement.procurementType ?? 'PURCHASE') === procurementType &&
      (procurement.supplierId ?? '') === (input.supplierId ?? ''),
    )
    .toArray()

  const incomingTotal = input.items.reduce((total, item) => total + item.totalCost, 0)
  const incomingProducts = [...input.items]
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join('|')

  for (const procurement of candidateHeaders) {
    const existingItems = await db.procurementItems
      .where('procurementId')
      .equals(procurement.id)
      .toArray()

    if (existingItems.length !== input.items.length) continue

    const existingTotal = existingItems.reduce((total, item) => total + item.totalCost, 0)
    const existingProducts = [...existingItems]
      .map((item) => `${item.productId}:${item.quantity}`)
      .sort()
      .join('|')

    if (existingTotal === incomingTotal && existingProducts === incomingProducts) {
      return procurement
    }
  }

  return undefined
}

export async function getLatestValidProcurementForProduct(
  productId: string,
): Promise<LatestValidProcurementForProduct | undefined> {
  if (!productId) return undefined

  const productItems = await db.procurementItems.where('productId').equals(productId).toArray()
  const matches: LatestValidProcurementForProduct[] = []

  for (const item of productItems) {
    const procurement = await db.procurements.get(item.procurementId)
    if (!procurement || procurement.status !== 'VALID') continue
    if ((procurement.procurementType ?? 'PURCHASE') !== 'PURCHASE') continue
    matches.push({ procurement, item })
  }

  matches.sort((a, b) => {
    const dateComparison = b.procurement.procurementDate.localeCompare(a.procurement.procurementDate)
    return dateComparison || b.procurement.createdAt.localeCompare(a.procurement.createdAt)
  })

  return matches[0]
}

export async function createProcurement(input: ProcurementInput) {
  validateProcurementInput(input)

  const procurementType = input.procurementType ?? 'PURCHASE'
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
        const product = await db.products.get(itemInput.productId)
        if (!product) {
          throw new Error('A product linked to this procurement was not found.')
        }

        const values = procurementType === 'PURCHASE'
          ? calculateProcurementValues(itemInput.quantity, itemInput.totalCost)
          : { unitCost: 0, suggestedSellingPrice: 0 }

        const appliedSellingPrice = itemInput.appliedSellingPrice ?? product.sellingPrice
        if (appliedSellingPrice <= 0) throw new Error('Selling price must be greater than zero.')

        preparedItems.push({ itemInput, product, ...values, appliedSellingPrice })
      }

      await db.procurements.add({
        id: procurementId,
        supplierId: procurementType === 'PURCHASE' ? input.supplierId : undefined,
        procurementType,
        procurementDate: input.procurementDate,
        status: 'VALID',
        createdAt,
      })

      for (const prepared of preparedItems) {
        const procurementItemId = crypto.randomUUID()

        await db.procurementItems.add({
          id: procurementItemId,
          procurementId,
          productId: prepared.itemInput.productId,
          quantity: prepared.itemInput.quantity,
          totalCost: prepared.itemInput.totalCost,
          unitCost: prepared.unitCost,
          markupRate: procurementType === 'PURCHASE' ? 0.25 : 0,
          previousSellingPrice: prepared.product.sellingPrice,
          suggestedSellingPrice: prepared.suggestedSellingPrice,
          appliedSellingPrice: prepared.appliedSellingPrice,
        })

        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          productId: prepared.itemInput.productId,
          type: procurementType === 'PURCHASE' ? 'RESTOCK' : 'OPENING',
          quantityDelta: prepared.itemInput.quantity,
          referenceId: procurementItemId,
          reason: procurementType === 'PURCHASE' ? 'Procurement' : 'Opening Inventory',
          createdAt,
        })

        const priceChanged = prepared.appliedSellingPrice !== prepared.product.sellingPrice

        await db.products.update(prepared.itemInput.productId, {
          currentStockCache: prepared.product.currentStockCache + prepared.itemInput.quantity,
          sellingPrice: prepared.appliedSellingPrice,
          updatedAt: createdAt,
        })

        if (priceChanged) {
          await db.priceHistory.add({
            id: crypto.randomUUID(),
            productId: prepared.itemInput.productId,
            previousPrice: prepared.product.sellingPrice,
            newPrice: prepared.appliedSellingPrice,
            procurementId,
            reason: procurementType === 'PURCHASE'
              ? 'Procurement price review'
              : 'Opening inventory price',
            changedAt: createdAt,
          })
        }
      }
    },
  )

  return procurementId
}

export async function voidProcurement(procurementId: string, reason: string) {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Void reason is required.')

  await db.transaction(
    'rw',
    db.procurements,
    db.procurementItems,
    db.products,
    db.inventoryMovements,
    async () => {
      const procurement = await db.procurements.get(procurementId)
      if (!procurement) throw new Error('Procurement record was not found.')
      if (procurement.status === 'VOID') throw new Error('This procurement has already been voided.')

      const items = await db.procurementItems.where('procurementId').equals(procurementId).toArray()
      if (items.length === 0) throw new Error('No product items were found for this procurement.')

      const stockUpdates: Array<{ item: ProcurementItem; newStock: number }> = []

      for (const item of items) {
        const product = await db.products.get(item.productId)
        if (!product) throw new Error('A product linked to this procurement was not found.')

        const newStock = product.currentStockCache - item.quantity
        if (newStock < 0) {
          throw new Error('This procurement cannot be voided because it would make current stock negative.')
        }
        stockUpdates.push({ item, newStock })
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

        await db.products.update(update.item.productId, {
          currentStockCache: update.newStock,
          updatedAt: voidedAt,
        })
      }

      await db.procurements.update(procurementId, {
        status: 'VOID',
        voidedAt,
        voidReason: trimmedReason,
      })
    },
  )
}
