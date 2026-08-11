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
  productId: string
  supplierId?: string
  procurementDate: string
  quantity: number
  totalCost: number
  unitCost: number
  markupRate: number
  suggestedSellingPrice: number
  createdAt: string
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

export class MiniStoreDatabase extends Dexie {
  products!: Table<Product, string>
  inventoryMovements!: Table<InventoryMovement, string>
  suppliers!: Table<Supplier, string>
  procurements!: Table<Procurement, string>
  priceHistory!: Table<PriceHistory, string>

  constructor() {
    super('miniStorePOS')

    this.version(1).stores({
      products: 'id, name, categoryId, active',
    })

    this.version(2).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements: 'id, productId, type, referenceId, createdAt',
    })

    this.version(3).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements: 'id, productId, type, referenceId, createdAt',
      suppliers: 'id, name, active',
      procurements: 'id, productId, supplierId, procurementDate, createdAt',
      priceHistory: 'id, productId, procurementId, changedAt',
    })
  }
}

export const db = new MiniStoreDatabase()