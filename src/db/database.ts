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

export interface Sale {
  id: string
  totalAmount: number
  paymentMethod: 'CASH' | 'GCASH'
  cashReceived?: number
  changeDue?: number
  status: 'VALID' | 'VOID' | 'REFUNDED'
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
  }
}

export const db = new MiniStoreDatabase()
