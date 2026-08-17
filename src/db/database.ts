import Dexie, { type Table } from 'dexie'

export interface Product {
  id: string
  sku?: string
  name: string
  categoryId?: string
  sellingPrice: number
  currentStockCache: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface InventoryMovement {
  id: string
  productId: string
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'VOID' | 'REFUND'
  quantityDelta: number
  referenceId?: string
  reason?: string
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Procurement {
  id: string
  supplierId?: string
  procurementDate: string
  status: 'VALID' | 'VOID'
  voidedAt?: string
  voidReason?: string
  createdAt: string
}

export interface ProcurementItem {
  id: string
  procurementId: string
  productId: string
  quantity: number
  totalCost: number
  unitCost: number
  markupRate: number
  previousSellingPrice?: number
  suggestedSellingPrice: number
  appliedSellingPrice?: number
}

export interface PriceHistory {
  id: string
  productId: string
  previousPrice: number
  newPrice: number
  procurementId?: string
  reason?: string
  changedAt: string
}

export interface BusinessDay {
  id: string
  status: 'OPEN' | 'CLOSED'
  openingCash: number
  openedAt: string
  closedAt?: string

  cashSalesTotal?: number
  gcashSalesTotal?: number
  cashRefundTotal?: number
  gcashRefundTotal?: number
  netSalesTotal?: number

  expectedClosingCash?: number
  actualClosingCash?: number
  cashVariance?: number

  closingNote?: string
}

export interface AppSetting {
  key: string
  value: string
}

export interface Sale {
  id: string
  totalAmount: number
  paymentMethod: 'CASH' | 'GCASH'
  cashReceived?: number
  changeDue?: number
  status: 'VALID' | 'VOID' | 'REFUNDED'
  businessDayId?: string
  reversalBusinessDayId?: string
  voidedAt?: string
  voidReason?: string
  refundedAt?: string
  refundReason?: string
  createdAt: string
}

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface InventoryReconciliation {
  id: string
  reconciliationDate: string
  reason: string
  note?: string
  countedItemCount: number
  adjustedItemCount: number
  createdAt: string
}

export interface InventoryReconciliationItem {
  id: string
  reconciliationId: string
  productId: string
  expectedQuantity: number
  physicalQuantity: number
  variance: number
}

export type SyncEntityType =
  | 'PRODUCT'
  | 'CATEGORY'
  | 'INVENTORY_MOVEMENT'
  | 'SUPPLIER'
  | 'PROCUREMENT'
  | 'PROCUREMENT_ITEM'
  | 'PRICE_HISTORY'
  | 'SALE'
  | 'SALE_ITEM'
  | 'BUSINESS_DAY'
  | 'APP_SETTING'
  | 'INVENTORY_RECONCILIATION'
  | 'INVENTORY_RECONCILIATION_ITEM'

export interface SyncQueueItem {
  id: string
  entityType: SyncEntityType
  entityId: string
  status: 'PENDING' | 'FAILED'
  attemptCount: number
  createdAt: string
  lastAttemptAt?: string
  lastError?: string
}

export class MiniStoreDatabase extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  inventoryMovements!: Table<InventoryMovement, string>
  suppliers!: Table<Supplier, string>
  procurements!: Table<Procurement, string>
  procurementItems!: Table<ProcurementItem, string>
  priceHistory!: Table<PriceHistory, string>
  sales!: Table<Sale, string>
  saleItems!: Table<SaleItem, string>
  businessDays!: Table<BusinessDay, string>
  appSettings!: Table<AppSetting, string>
  inventoryReconciliations!: Table<
    InventoryReconciliation,
    string
  >
  inventoryReconciliationItems!: Table<
    InventoryReconciliationItem,
    string
  >
  syncQueue!: Table<SyncQueueItem, string>

  constructor() {
    super('miniStorePOS')

    this.version(1).stores({
      products: 'id, name, categoryId, active',
    })

    this.version(2).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements:
        'id, productId, type, referenceId, createdAt',
    })

    this.version(3).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements:
        'id, productId, type, referenceId, createdAt',
      suppliers: 'id, name, active',
      procurements:
        'id, productId, supplierId, procurementDate, createdAt',
      priceHistory:
        'id, productId, procurementId, changedAt',
    })

    this.version(4)
      .stores({
        products: 'id, name, categoryId, active',
        inventoryMovements:
          'id, productId, type, referenceId, createdAt',
        suppliers: 'id, name, active',
        procurements:
          'id, productId, supplierId, procurementDate, status, createdAt',
        priceHistory:
          'id, productId, procurementId, changedAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table('procurements')
          .toCollection()
          .modify((procurement) => {
            procurement.status = 'ACTIVE'
          })
      })

    this.version(5)
      .stores({
        products: 'id, name, categoryId, active',
        inventoryMovements:
          'id, productId, type, referenceId, createdAt',
        suppliers: 'id, name, active',
        procurements:
          'id, productId, supplierId, procurementDate, status, createdAt',
        priceHistory:
          'id, productId, procurementId, changedAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table('procurements')
          .toCollection()
          .modify((procurement) => {
            if (
              procurement.status === 'ACTIVE' ||
              !procurement.status
            ) {
              procurement.status = 'VALID'
            }
          })
      })

    this.version(6).stores({
      products: 'id, name, categoryId, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',
    })

    this.version(7).stores({
      products: 'id, name, categoryId, active',

      categories:
        'id, name, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',
    })

    this.version(8).stores({
      products: 'id, name, categoryId, active',

      categories:
        'id, name, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',

      sales:
        'id, paymentMethod, status, createdAt',

      saleItems:
        'id, saleId, productId',
    })

    this.version(9).stores({
      products: 'id, name, categoryId, active',

      categories:
        'id, name, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',

      sales:
        'id, paymentMethod, status, createdAt',

      saleItems:
        'id, saleId, productId',
    })

    this.version(10).stores({
      products: 'id, name, categoryId, active',

      categories:
        'id, name, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',

      sales:
        'id, paymentMethod, status, businessDayId, reversalBusinessDayId, createdAt',

      saleItems:
        'id, saleId, productId',

      businessDays:
        'id, status, openedAt, closedAt',

      appSettings:
        'key',
    })

    this.version(11).stores({
      products:
        'id, name, categoryId, active',

      categories:
        'id, name, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',

      sales:
        'id, paymentMethod, status, businessDayId, reversalBusinessDayId, createdAt',

      saleItems:
        'id, saleId, productId',

      businessDays:
        'id, status, openedAt, closedAt',

      appSettings:
        'key',

      inventoryReconciliations:
        'id, reconciliationDate, createdAt',

      inventoryReconciliationItems:
        'id, reconciliationId, productId',
    })

    this.version(12).stores({
      products:
        'id, name, categoryId, active',

      categories:
        'id, name, active',

      inventoryMovements:
        'id, productId, type, referenceId, createdAt',

      suppliers:
        'id, name, active',

      procurements:
        'id, supplierId, procurementDate, status, createdAt',

      procurementItems:
        'id, procurementId, productId',

      priceHistory:
        'id, productId, procurementId, changedAt',

      sales:
        'id, paymentMethod, status, businessDayId, reversalBusinessDayId, createdAt',

      saleItems:
        'id, saleId, productId',

      businessDays:
        'id, status, openedAt, closedAt',

      appSettings:
        'key',

      inventoryReconciliations:
        'id, reconciliationDate, createdAt',

      inventoryReconciliationItems:
        'id, reconciliationId, productId',

      syncQueue:
        'id, &[entityType+entityId], status, createdAt',
    })
  }
}

export const db = new MiniStoreDatabase()