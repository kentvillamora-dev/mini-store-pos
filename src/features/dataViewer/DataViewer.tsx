import { useEffect, useState } from 'react'
import {
  db,
  type Product,
  type InventoryMovement,
  type Supplier,
  type Procurement,
} from '../../db/database'

function DataViewer() {
  const [products, setProducts] = useState<Product[]>([])
  const [inventoryMovements, setInventoryMovements] =
    useState<InventoryMovement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])

  useEffect(() => {
    async function loadData() {
      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      const movementRecords = await db.inventoryMovements.toArray()
      setInventoryMovements(movementRecords)

      const supplierRecords = await db.suppliers.toArray()
      setSuppliers(supplierRecords)

      const procurementRecords = await db.procurements.toArray()
      setProcurements(procurementRecords)
    }

    loadData()
  }, [])

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
          </tr>
        </thead>

        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Procurements</h2>

      <table>
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Supplier ID</th>
            <th>Date</th>
            <th>Quantity</th>
            <th>Total Cost</th>
            <th>Unit Cost</th>
            <th>Suggested SRP</th>
          </tr>
        </thead>

        <tbody>
          {procurements.map((procurement) => (
            <tr key={procurement.id}>
              <td>{procurement.productId}</td>
              <td>{procurement.supplierId ?? '-'}</td>
              <td>{procurement.procurementDate}</td>
              <td>{procurement.quantity}</td>
              <td>₱{procurement.totalCost.toFixed(2)}</td>
              <td>₱{procurement.unitCost.toFixed(2)}</td>
              <td>₱{procurement.suggestedSellingPrice.toFixed(2)}</td>
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