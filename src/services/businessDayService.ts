import { db, type BusinessDay } from '../db/database'

const EOD_WORKFLOW_SETTING_KEY = 'eodWorkflowEnabled'

export async function getEodWorkflowEnabled() {
  const setting = await db.appSettings.get(
    EOD_WORKFLOW_SETTING_KEY,
  )

  return setting?.value === 'true'
}

export async function setEodWorkflowEnabled(
  enabled: boolean,
) {
  await db.transaction(
    'rw',
    db.appSettings,
    db.businessDays,
    async () => {
      if (!enabled) {
        const openBusinessDay = await db.businessDays
          .where('status')
          .equals('OPEN')
          .first()

        if (openBusinessDay) {
          throw new Error(
            'Close the current business day before disabling Daily Opening & Closing.',
          )
        }
      }

      await db.appSettings.put({
        key: EOD_WORKFLOW_SETTING_KEY,
        value: enabled ? 'true' : 'false',
      })
    },
  )
}

export async function getOpenBusinessDay() {
  return (
    (await db.businessDays
      .where('status')
      .equals('OPEN')
      .first()) ?? null
  )
}

export async function openBusinessDay(
  openingCash: number,
) {
  if (
    !Number.isFinite(openingCash) ||
    openingCash < 0
  ) {
    throw new Error(
      'Opening cash must be zero or greater.',
    )
  }

  const businessDay: BusinessDay = {
    id: crypto.randomUUID(),
    status: 'OPEN',
    openingCash,
    openedAt: new Date().toISOString(),
  }

  await db.transaction(
    'rw',
    db.businessDays,
    async () => {
      const existingOpenBusinessDay =
        await db.businessDays
          .where('status')
          .equals('OPEN')
          .first()

      if (existingOpenBusinessDay) {
        throw new Error(
          'A business day is already open.',
        )
      }

      await db.businessDays.add(businessDay)
    },
  )

  return businessDay
}

export async function closeBusinessDay(
  actualClosingCash: number,
  closingNote?: string,
) {
  if (
    !Number.isFinite(actualClosingCash) ||
    actualClosingCash < 0
  ) {
    throw new Error(
      'Actual closing cash must be zero or greater.',
    )
  }

  return db.transaction(
    'rw',
    db.businessDays,
    db.sales,
    async () => {
      const businessDay = await db.businessDays
        .where('status')
        .equals('OPEN')
        .first()

      if (!businessDay) {
        throw new Error(
          'There is no open business day to close.',
        )
      }

      const originalSales = await db.sales
        .where('businessDayId')
        .equals(businessDay.id)
        .toArray()

      const reversals = await db.sales
        .where('reversalBusinessDayId')
        .equals(businessDay.id)
        .toArray()

      const cashSalesTotal = originalSales
        .filter(
          (sale) =>
            sale.paymentMethod === 'CASH' &&
            sale.status !== 'VOID',
        )
        .reduce(
          (total, sale) =>
            total + sale.totalAmount,
          0,
        )

      const gcashSalesTotal = originalSales
        .filter(
          (sale) =>
            sale.paymentMethod === 'GCASH' &&
            sale.status !== 'VOID',
        )
        .reduce(
          (total, sale) =>
            total + sale.totalAmount,
          0,
        )

      const cashRefundTotal = reversals
        .filter(
          (sale) =>
            sale.status === 'REFUNDED' &&
            sale.paymentMethod === 'CASH',
        )
        .reduce(
          (total, sale) =>
            total + sale.totalAmount,
          0,
        )

      const gcashRefundTotal = reversals
        .filter(
          (sale) =>
            sale.status === 'REFUNDED' &&
            sale.paymentMethod === 'GCASH',
        )
        .reduce(
          (total, sale) =>
            total + sale.totalAmount,
          0,
        )

      const netSalesTotal =
        cashSalesTotal +
        gcashSalesTotal -
        cashRefundTotal -
        gcashRefundTotal

      const expectedClosingCash =
        businessDay.openingCash +
        cashSalesTotal -
        cashRefundTotal

      const cashVariance =
        actualClosingCash - expectedClosingCash

      const trimmedClosingNote =
        closingNote?.trim() || undefined

      const closedAt = new Date().toISOString()

      await db.businessDays.update(
        businessDay.id,
        {
          status: 'CLOSED',
          closedAt,

          cashSalesTotal,
          gcashSalesTotal,
          cashRefundTotal,
          gcashRefundTotal,
          netSalesTotal,

          expectedClosingCash,
          actualClosingCash,
          cashVariance,

          closingNote: trimmedClosingNote,
        },
      )

      const closedBusinessDay =
        await db.businessDays.get(businessDay.id)

      if (!closedBusinessDay) {
        throw new Error(
          'Unable to retrieve the closed business day.',
        )
      }

      return closedBusinessDay
    },
  )
}