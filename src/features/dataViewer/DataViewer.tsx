import { useEffect, useState } from 'react'
import {
  db,
  type Product,
  type InventoryMovement,
  type Supplier,
  type Procurement,
  type PriceHistory,
} from '../../db/database'

import { deleteSupplier } from '../../services/supplierService'
import { voidProcurement } from '../../services/procurementService'


interface DataViewerProps {
  onSuppliersChanged: () => Promise<void>
}

function DataViewer({ onSuppliersChanged }: DataViewerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [inventoryMovements, setInventoryMovements] =
    useState<InventoryMovement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [supplierMessage, setSupplierMessage] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')

  useEffect(() => {
    async function loadData() {
      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      const movementRecords = await db.inventoryMovements.toArray()
      setInventoryMovements(movementRecords)

      const supplierRecords = await db.suppliers.toArray()
      setSuppliers(supplierRecords)

      const procurementRecords = await db.procurements
      .orderBy('createdAt')
      .reverse()
      .toArray()

      setProcurements(procurementRecords)

      const priceHistoryRecords = await db.priceHistory.toArray()
      setPriceHistory(priceHistoryRecords)
    }

    loadData()
  }, [])

  async function handleDeleteSupplier(supplierId: string) {
    try {
      await deleteSupplier(supplierId)

      const supplierRecords = await db.suppliers.toArray()
      setSuppliers(supplierRecords)

      await onSuppliersChanged()

      setSupplierMessage('Supplier deleted.')
    } catch (error) {
      if (error instanceof Error) {
        setSupplierMessage(error.message)
        return
      }

      setSupplierMessage('Unable to delete supplier.')
    }
  }

  async function handleVoidProcurement(procurementId: string) {
    const reason = window.prompt('Enter the reason for voiding this procurement:')

    if (reason === null) {
      return
    }

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setProcurementMessage('Void reason is required.')
      return
    }

    const confirmed = window.confirm(
      'Void this procurement?\n\n' +
        'This will preserve the procurement record, create a VOID inventory movement, and reverse its stock effect.',
    )

    if (!confirmed) {
      setProcurementMessage('Procurement void cancelled.')
      return
    }

    try {
      await voidProcurement(procurementId, trimmedReason)

      const procurementRecords = await db.procurements
        .orderBy('createdAt')
        .reverse()
        .toArray()

      setProcurements(procurementRecords)

      const movementRecords = await db.inventoryMovements.toArray()
      setInventoryMovements(movementRecords)

      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      setProcurementMessage('Procurement voided.')
    } catch (error) {
      if (error instanceof Error) {
        setProcurementMessage(error.message)
        return
      }

      setProcurementMessage('Unable to void procurement.')
    }
  }

  return (
    <section>
      <h1>Data Viewer</h1>

      <h2>Products</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Selling Price</th>
            <th>Stock Cache</th>
            <th>Active</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>₱{product.sellingPrice.toFixed(2)}</td>
              <td>{product.currentStockCache}</td>
              <td>{product.active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Suppliers</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Active</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.active ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => handleDeleteSupplier(supplier.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {supplierMessage && <p>{supplierMessage}</p>}

      <h2>Procurements</h2>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Supplier</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Total Cost</th>
            <th>Unit Cost</th>
            <th>SRP</th>
            <th>Status</th>
            <th>Action</th>
            <th>Void Reason</th>
          </tr>
        </thead>

        <tbody>
          {procurements.map((procurement) => (
            <tr key={procurement.id}>
              <td>{procurement.procurementDate}</td>
              <td>
                {procurement.supplierId
                  ? suppliers.find(
                    (supplier) => supplier.id === procurement.supplierId,
                  )?.name ?? 'Unknown supplier' : '-'}
              </td>
              <td>
                {products.find(
                  (product) => product.id === procurement.productId,
                )?.name ?? 'Unknown product'}
              </td>
              <td>{procurement.quantity}</td>
              <td>₱{procurement.totalCost.toFixed(2)}</td>
              <td>₱{procurement.unitCost.toFixed(2)}</td>
              <td>₱{procurement.suggestedSellingPrice.toFixed(2)}</td>
              <td>{procurement.status}</td>
              <td>
                {procurement.status === 'VALID' ? (
                  <button onClick={() => handleVoidProcurement(procurement.id)}>
                    Void
                  </button>
                ) : (
                  '-'
                )}
              </td>
              <td>{procurement.voidReason ?? 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {procurementMessage && <p>{procurementMessage}</p>}

      <h2>Price History</h2>

      <table>
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Previous Price</th>
            <th>New Price</th>
            <th>Procurement ID</th>
            <th>Reason</th>
            <th>Changed At</th>
          </tr>
        </thead>

        <tbody>
          {priceHistory.map((priceChange) => (
            <tr key={priceChange.id}>
              <td>{priceChange.productId}</td>
              <td>₱{priceChange.previousPrice.toFixed(2)}</td>
              <td>₱{priceChange.newPrice.toFixed(2)}</td>
              <td>{priceChange.procurementId ?? '-'}</td>
              <td>{priceChange.reason ?? '-'}</td>
              <td>{priceChange.changedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Inventory Movements</h2>

      <table>
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Type</th>
            <th>Quantity Delta</th>
            <th>Reference ID</th>
            <th>Reason</th>
            <th>Created At</th>
          </tr>
        </thead>

        <tbody>
          {inventoryMovements.map((movement) => (
            <tr key={movement.id}>
              <td>{movement.productId}</td>
              <td>{movement.type}</td>
              <td>{movement.quantityDelta}</td>
              <td>{movement.referenceId ?? '-'}</td>
              <td>{movement.reason ?? '-'}</td>
              <td>{movement.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default DataViewer