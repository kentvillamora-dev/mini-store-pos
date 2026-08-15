import { db } from '../db/database'
import { calculateSuggestedSellingPrice } from '../utils/pricing'

export interface ProcurementInput {
  productId: string
  supplierId?: string
  procurementDate: string
  quantity: number
  totalCost: number
}

export function calculateProcurementValues(input: ProcurementInput) {
  const unitCost = input.totalCost / input.quantity
  const suggestedSellingPrice = calculateSuggestedSellingPrice(unitCost)

  return {
    unitCost,
    suggestedSellingPrice,
  }
}

export function validateProcurementInput(input: ProcurementInput) {
  if (!input.productId) {
    throw new Error('Product is required.')
  }

  if (!input.supplierId) {
    throw new Error('Supplier is required.')
  }

  if (!input.procurementDate) {
    throw new Error('Procurement date is required.')
  }

  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero.')
  }

  if (input.totalCost <= 0) {
    throw new Error('Total cost must be greater that zero.')
  }
}

export async function findPotentialDuplicateProcurement(
  input: ProcurementInput,
) {
  return db.procurements
    .where('procurementDate')
    .equals(input.procurementDate)
    .and(
      (procurement) =>
        procurement.supplierId === input.supplierId &&
        procurement.productId === input.productId &&
        procurement.totalCost === input.totalCost,
    )
    .first()
}

export async function createProcurement(input: ProcurementInput) {
  validateProcurementInput(input)

  const product = await db.products.get(input.productId)

  if (!product) {
    throw new Error('Product not found.')
  }

  const { unitCost, suggestedSellingPrice } =
    calculateProcurementValues(input)

  const procurementId = crypto.randomUUID()
  const movementId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await db.transaction(
    'rw',
    db.procurements,
    db.inventoryMovements,
    db.products,
    async () => {
      await db.procurements.add({
        id: procurementId,
        productId: input.productId,
        supplierId: input.supplierId,
        procurementDate: input.procurementDate,
        quantity: input.quantity,
        totalCost: input.totalCost,
        unitCost,
        markupRate: 0.25,
        suggestedSellingPrice,
        status: 'VALID',
        createdAt,
      })

      await db.inventoryMovements.add({
        id: movementId,
        productId: input.productId,
        type: 'RESTOCK',
        quantityDelta: input.quantity,
        referenceId: procurementId,
        reason: 'Procurement',
        createdAt,
      })

      await db.products.update(input.productId, {
        currentStockCache:
          product.currentStockCache + input.quantity,
        updatedAt: createdAt,
      })
    },
  )
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
    db.products,
    db.inventoryMovements,
    async () => {
      const procurement = await db.procurements.get(procurementId)

      if (!procurement) {
        throw new Error('Procurement record was not found.')
      }

      if (procurement.status === 'VOID') {
        throw new Error('This procurement has already been voided.')
      }

      const product = await db.products.get(procurement.productId)

      if (!product) {
        throw new Error('Product linked to this procurement was not found.')
      }

      const newStock = product.currentStockCache - procurement.quantity

      if (newStock < 0) {
        throw new Error(
          'This procurement cannot be voided because it would make current stock negative.',
        )
      }

      const voidedAt = new Date().toISOString()

      await db.inventoryMovements.add({
        id: crypto.randomUUID(),
        productId: procurement.productId,
        type: 'VOID',
        quantityDelta: -procurement.quantity,
        referenceId: procurement.id,
        reason: trimmedReason,
        createdAt: voidedAt,
      })

      await db.products.update(procurement.productId, {
        currentStockCache: newStock,
        updatedAt: voidedAt,
      })

      await db.procurements.update(procurement.id, {
        status: 'VOID',
        voidedAt,
        voidReason: trimmedReason,
      })
    },
  )
}