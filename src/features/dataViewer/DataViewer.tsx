import { useEffect, useState } from 'react'
import {
  db,
  type Category,
  type Product,
  type InventoryMovement,
  type Supplier,
  type Procurement,
  type ProcurementItem,
  type PriceHistory,
} from '../../db/database'

import { updateProduct } from '../../services/productService'
import { deleteSupplier } from '../../services/supplierService'
import { voidProcurement } from '../../services/procurementService'

interface DataViewerProps {
  onProductsChanged: () => Promise<void>
  onSuppliersChanged: () => Promise<void>
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function DataViewer({
  onProductsChanged,
  onSuppliersChanged,
}: DataViewerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [inventoryMovements, setInventoryMovements] =
    useState<InventoryMovement[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [procurementItems, setProcurementItems] =
    useState<ProcurementItem[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])

  const [editingProductId, setEditingProductId] = useState<
    string | null
  >(null)
  const [editingProductName, setEditingProductName] = useState('')
  const [editingProductCategoryId, setEditingProductCategoryId] =
    useState('')
  const [productMessage, setProductMessage] = useState('')

  const [supplierMessage, setSupplierMessage] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')

  useEffect(() => {
    async function loadData() {
      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      const categoryRecords = await db.categories.toArray()
      setCategories(categoryRecords)

      const movementRecords = await db.inventoryMovements
        .orderBy('createdAt')
        .reverse()
        .toArray()

      setInventoryMovements(movementRecords)

      const supplierRecords = await db.suppliers.toArray()
      setSuppliers(supplierRecords)

      const procurementRecords = await db.procurements
        .orderBy('createdAt')
        .reverse()
        .toArray()

      setProcurements(procurementRecords)

      const procurementItemRecords =
        await db.procurementItems.toArray()

      setProcurementItems(procurementItemRecords)

      const priceHistoryRecords = await db.priceHistory
        .orderBy('changedAt')
        .reverse()
        .toArray()

      setPriceHistory(priceHistoryRecords)
    }

    loadData()
  }, [])

  function getCategoryName(categoryId?: string) {
    if (!categoryId) {
      return 'Uncategorized'
    }

    return (
      categories.find(
        (category) => category.id === categoryId,
      )?.name ?? 'Uncategorized'
    )
  }

  const sortedProducts = [...products].sort((a, b) => {
    const categoryA = getCategoryName(a.categoryId)
    const categoryB = getCategoryName(b.categoryId)

    const categoryComparison = categoryA.localeCompare(
      categoryB,
      'en',
      {
        sensitivity: 'base',
      },
    )

    if (categoryComparison !== 0) {
      return categoryComparison
    }

    return a.name.localeCompare(b.name, 'en', {
      sensitivity: 'base',
    })
  })

  const sortedCategories = [...categories]
    .filter((category) => category.active)
    .sort((a, b) =>
      a.name.localeCompare(b.name, 'en', {
        sensitivity: 'base',
      }),
    )

  function handleStartEditProduct(product: Product) {
    setEditingProductId(product.id)
    setEditingProductName(product.name)
    setEditingProductCategoryId(product.categoryId ?? '')
    setProductMessage('')
  }

  function handleCancelEditProduct() {
    setEditingProductId(null)
    setEditingProductName('')
    setEditingProductCategoryId('')
    setProductMessage('')
  }

  async function handleSaveProduct(productId: string) {
    try {
      await updateProduct(
        productId,
        editingProductName,
        editingProductCategoryId,
      )

      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      await onProductsChanged()

      setEditingProductId(null)
      setEditingProductName('')
      setEditingProductCategoryId('')
      setProductMessage('Product updated.')
    } catch (error) {
      if (error instanceof Error) {
        setProductMessage(error.message)
        return
      }

      setProductMessage('Unable to update product.')
    }
  }

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
    const reason = window.prompt(
      'Enter the reason for voiding this procurement:',
    )

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
        'This will preserve the procurement record, create VOID inventory movements for all items, and reverse the procurement stock effect.',
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

      const procurementItemRecords =
        await db.procurementItems.toArray()

      setProcurementItems(procurementItemRecords)

      const movementRecords = await db.inventoryMovements
        .orderBy('createdAt')
        .reverse()
        .toArray()

      setInventoryMovements(movementRecords)

      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      await onProductsChanged()

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
            <th>Category</th>
            <th>Product</th>
            <th>Selling Price</th>
            <th>Stock Cache</th>
            <th>Active</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {sortedProducts.map((product) => {
            const isEditing =
              editingProductId === product.id

            return (
              <tr key={product.id}>
                <td>
                  {isEditing ? (
                    <select
                      value={editingProductCategoryId}
                      onChange={(event) =>
                        setEditingProductCategoryId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        Select a category
                      </option>

                      {sortedCategories.map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    getCategoryName(product.categoryId)
                  )}
                </td>

                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingProductName}
                      onChange={(event) =>
                        setEditingProductName(
                          event.target.value,
                        )
                      }
                    />
                  ) : (
                    product.name
                  )}
                </td>

                <td>
                  ₱{product.sellingPrice.toFixed(2)}
                </td>

                <td>{product.currentStockCache}</td>

                <td>
                  {product.active ? 'Yes' : 'No'}
                </td>

                <td>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() =>
                          handleSaveProduct(product.id)
                        }
                      >
                        Save
                      </button>

                      <button
                        onClick={handleCancelEditProduct}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() =>
                        handleStartEditProduct(product)
                      }
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {productMessage && <p>{productMessage}</p>}

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
                <button
                  onClick={() =>
                    handleDeleteSupplier(supplier.id)
                  }
                >
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
            <th>Previous Price</th>
            <th>SRP</th>
            <th>Applied Price</th>
            <th>Status</th>
            <th>Action</th>
            <th>Void Reason</th>
          </tr>
        </thead>

        <tbody>
          {procurements.flatMap((procurement) => {
            const items = procurementItems.filter(
              (item) =>
                item.procurementId === procurement.id,
            )

            const supplierName = procurement.supplierId
              ? suppliers.find(
                  (supplier) =>
                    supplier.id ===
                    procurement.supplierId,
                )?.name ?? 'Unknown supplier'
              : '-'

            if (items.length === 0) {
              return [
                <tr key={procurement.id}>
                  <td>{procurement.procurementDate}</td>
                  <td>{supplierName}</td>
                  <td colSpan={7}>
                    No procurement items found
                  </td>
                  <td>{procurement.status}</td>
                  <td>
                    {procurement.status === 'VALID' ? (
                      <button
                        onClick={() =>
                          handleVoidProcurement(
                            procurement.id,
                          )
                        }
                      >
                        Void
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {procurement.voidReason ?? 'N/A'}
                  </td>
                </tr>,
              ]
            }

            return items.map((item, index) => {
              const productName =
                products.find(
                  (product) =>
                    product.id === item.productId,
                )?.name ?? 'Unknown product'

              const isFirstItem = index === 0

              return (
                <tr key={item.id}>
                  {isFirstItem && (
                    <>
                      <td rowSpan={items.length}>
                        {procurement.procurementDate}
                      </td>

                      <td rowSpan={items.length}>
                        {supplierName}
                      </td>
                    </>
                  )}

                  <td>{productName}</td>
                  <td>{item.quantity}</td>
                  <td>
                    ₱{item.totalCost.toFixed(2)}
                  </td>
                  <td>
                    ₱{item.unitCost.toFixed(2)}
                  </td>

                  <td>
                    {item.previousSellingPrice !==
                    undefined
                      ? `₱${item.previousSellingPrice.toFixed(
                          2,
                        )}`
                      : '-'}
                  </td>

                  <td>
                    ₱
                    {item.suggestedSellingPrice.toFixed(
                      2,
                    )}
                  </td>

                  <td>
                    {item.appliedSellingPrice !==
                    undefined
                      ? `₱${item.appliedSellingPrice.toFixed(
                          2,
                        )}`
                      : '-'}
                  </td>

                  {isFirstItem && (
                    <>
                      <td rowSpan={items.length}>
                        {procurement.status}
                      </td>

                      <td rowSpan={items.length}>
                        {procurement.status ===
                        'VALID' ? (
                          <button
                            onClick={() =>
                              handleVoidProcurement(
                                procurement.id,
                              )
                            }
                          >
                            Void
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td rowSpan={items.length}>
                        {procurement.voidReason ??
                          'N/A'}
                      </td>
                    </>
                  )}
                </tr>
              )
            })
          })}
        </tbody>
      </table>

      {procurementMessage && (
        <p>{procurementMessage}</p>
      )}

      <h2>Price History</h2>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Previous Price</th>
            <th>New Price</th>
            <th>Reason</th>
            <th>Changed At</th>
          </tr>
        </thead>

        <tbody>
          {priceHistory.map((priceChange) => (
            <tr key={priceChange.id}>
              <td>
                {products.find(
                  (product) =>
                    product.id ===
                    priceChange.productId,
                )?.name ?? 'Unknown product'}
              </td>

              <td>
                ₱{priceChange.previousPrice.toFixed(2)}
              </td>
              <td>
                ₱{priceChange.newPrice.toFixed(2)}
              </td>
              <td>{priceChange.reason ?? '-'}</td>
              <td>
                {formatDateTime(priceChange.changedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Inventory Movements</h2>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Reason</th>
            <th>Created At</th>
          </tr>
        </thead>

        <tbody>
          {inventoryMovements.map((movement) => (
            <tr key={movement.id}>
              <td>
                {products.find(
                  (product) =>
                    product.id === movement.productId,
                )?.name ?? 'Unknown product'}
              </td>

              <td>{movement.type}</td>
              <td>{movement.quantityDelta}</td>
              <td>{movement.reason ?? '-'}</td>
              <td>
                {formatDateTime(movement.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default DataViewer