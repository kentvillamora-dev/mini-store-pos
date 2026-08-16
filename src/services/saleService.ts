import { db } from '../db/database'

const EOD_WORKFLOW_SETTING_KEY = 'eodWorkflowEnabled'

export interface SaleItemInput {
  productId: string
  quantity: number
  unitPrice: number
}

export interface SaleInput {
  paymentMethod: 'CASH' | 'GCASH'
  cashReceived?: number
  items: SaleItemInput[]
}

export function validateSaleInput(input: SaleInput) {
  if (input.items.length === 0) {
    throw new Error(
      'Add at least one product before completing the sale.',
    )
  }

  if (
    input.paymentMethod !== 'CASH' &&
    input.paymentMethod !== 'GCASH'
  ) {
    throw new Error('A valid payment method is required.')
  }

  const productIds = new Set<string>()

  for (const item of input.items) {
    if (!item.productId) {
      throw new Error('A product is required.')
    }

    if (productIds.has(item.productId)) {
      throw new Error(
        'The same product cannot appear more than once in a sale.',
      )
    }

    productIds.add(item.productId)

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error(
        'Sale quantity must be a whole number greater than zero.',
      )
    }

    if (
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice <= 0
    ) {
      throw new Error(
        'Sale unit price must be greater than zero.',
      )
    }
  }

  const totalAmount = input.items.reduce(
    (total, item) =>
      total + item.unitPrice * item.quantity,
    0,
  )

  if (input.paymentMethod === 'CASH') {
    if (
      input.cashReceived === undefined ||
      !Number.isFinite(input.cashReceived)
    ) {
      throw new Error('Cash received is required.')
    }

    if (input.cashReceived < totalAmount) {
      throw new Error(
        'Cash received is less than the sale total.',
      )
    }
  }

  return totalAmount
}

export async function createSale(input: SaleInput) {
  const totalAmount = validateSaleInput(input)
  const saleId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await db.transaction(
    'rw',
    [
      db.sales,
      db.saleItems,
      db.inventoryMovements,
      db.products,
      db.appSettings,
      db.businessDays,
    ],
    async () => {
      const eodSetting = await db.appSettings.get(
        EOD_WORKFLOW_SETTING_KEY,
      )

      const eodWorkflowEnabled =
        eodSetting?.value === 'true'

      let businessDayId: string | undefined

      if (eodWorkflowEnabled) {
        const openBusinessDay =
          await db.businessDays
            .where('status')
            .equals('OPEN')
            .first()

        if (!openBusinessDay) {
          throw new Error(
            'Open a business day before completing a sale.',
          )
        }

        businessDayId = openBusinessDay.id
      }

      const preparedItems: Array<{
        productId: string
        quantity: number
        unitPrice: number
        lineTotal: number
        currentStock: number
      }> = []

      for (const item of input.items) {
        const product = await db.products.get(
          item.productId,
        )

        if (!product) {
          throw new Error(
            'A product linked to this sale was not found.',
          )
        }

        if (!product.active) {
          throw new Error(
            `${product.name} is no longer active.`,
          )
        }

        if (
          item.quantity >
          product.currentStockCache
        ) {
          throw new Error(
            `${product.name} does not have enough stock to complete this sale.`,
          )
        }

        preparedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal:
            item.unitPrice * item.quantity,
          currentStock:
            product.currentStockCache,
        })
      }

      const cashReceived =
        input.paymentMethod === 'CASH'
          ? input.cashReceived
          : undefined

      const changeDue =
        input.paymentMethod === 'CASH' &&
        cashReceived !== undefined
          ? cashReceived - totalAmount
          : undefined

      await db.sales.add({
        id: saleId,
        totalAmount,
        paymentMethod: input.paymentMethod,
        cashReceived,
        changeDue,
        status: 'VALID',
        businessDayId,
        createdAt,
      })

      for (const item of preparedItems) {
        const saleItemId =
          crypto.randomUUID()

        await db.saleItems.add({
          id: saleItemId,
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })

        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          productId: item.productId,
          type: 'SALE',
          quantityDelta: -item.quantity,
          referenceId: saleItemId,
          reason: 'Sale',
          createdAt,
        })

        await db.products.update(
          item.productId,
          {
            currentStockCache:
              item.currentStock -
              item.quantity,
            updatedAt: createdAt,
          },
        )
      }
    },
  )

  return saleId
}

async function reverseSale(
  saleId: string,
  reason: string,
  reversalType: 'VOID' | 'REFUND',
) {
  const trimmedReason = reason.trim()

  if (!trimmedReason) {
    throw new Error(
      reversalType === 'VOID'
        ? 'Void reason is required.'
        : 'Refund reason is required.',
    )
  }

  await db.transaction(
    'rw',
    [
      db.sales,
      db.saleItems,
      db.inventoryMovements,
      db.products,
      db.appSettings,
      db.businessDays,
    ],
    async () => {
      const sale = await db.sales.get(saleId)

      if (!sale) {
        throw new Error(
          'Sale record was not found.',
        )
      }

      if (sale.status !== 'VALID') {
        throw new Error(
          'Only a valid sale can be voided or refunded.',
        )
      }

      const eodSetting =
        await db.appSettings.get(
          EOD_WORKFLOW_SETTING_KEY,
        )

      const eodWorkflowEnabled =
        eodSetting?.value === 'true'

      let reversalBusinessDayId:
        | string
        | undefined

      if (eodWorkflowEnabled) {
        const openBusinessDay =
          await db.businessDays
            .where('status')
            .equals('OPEN')
            .first()

        if (reversalType === 'VOID') {
          if (
            !sale.businessDayId ||
            !openBusinessDay ||
            openBusinessDay.id !==
              sale.businessDayId
          ) {
            throw new Error(
              'This sale can no longer be voided because its original business day is not open. Use Refund instead.',
            )
          }
        } else {
          if (!openBusinessDay) {
            throw new Error(
              'Open a business day before refunding a sale.',
            )
          }

          reversalBusinessDayId =
            openBusinessDay.id
        }
      }

      const items = await db.saleItems
        .where('saleId')
        .equals(saleId)
        .toArray()

      if (items.length === 0) {
        throw new Error(
          'No product items were found for this sale.',
        )
      }

      const reversedAt =
        new Date().toISOString()

      for (const item of items) {
        const product =
          await db.products.get(
            item.productId,
          )

        if (!product) {
          throw new Error(
            'A product linked to this sale was not found.',
          )
        }

        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          productId: item.productId,
          type: reversalType,
          quantityDelta: item.quantity,
          referenceId: item.id,
          reason: trimmedReason,
          createdAt: reversedAt,
        })

        await db.products.update(
          item.productId,
          {
            currentStockCache:
              product.currentStockCache +
              item.quantity,
            updatedAt: reversedAt,
          },
        )
      }

      if (reversalType === 'VOID') {
        await db.sales.update(saleId, {
          status: 'VOID',
          voidedAt: reversedAt,
          voidReason: trimmedReason,
        })
      } else {
        await db.sales.update(saleId, {
          status: 'REFUNDED',
          reversalBusinessDayId,
          refundedAt: reversedAt,
          refundReason: trimmedReason,
        })
      }
    },
  )
}

export async function voidSale(
  saleId: string,
  reason: string,
) {
  await reverseSale(
    saleId,
    reason,
    'VOID',
  )
}

export async function refundSale(
  saleId: string,
  reason: string,
) {
  await reverseSale(
    saleId,
    reason,
    'REFUND',
  )
}