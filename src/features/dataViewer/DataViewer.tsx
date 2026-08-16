import { useEffect, useState } from 'react'
import {
  db,
  type Category,
  type Product,
  type Supplier,
  type Procurement,
  type ProcurementItem,
  type Sale,
} from '../../db/database'

import InventoryReconciliationPanel from '../inventoryReconciliation/InventoryReconciliationPanel'
import { updateProduct } from '../../services/productService'
import { deleteSupplier } from '../../services/supplierService'
import { voidProcurement } from '../../services/procurementService'
import {
  refundSale,
  voidSale,
} from '../../services/saleService'

interface DataViewerProps {
  onProductsChanged: () => Promise<void>
  onSuppliersChanged: () => Promise<void>
}

type LedgerSection =
  | 'sales'
  | 'procurements'
  | 'products'
  | 'suppliers'

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [procurementItems, setProcurementItems] =
    useState<ProcurementItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [expandedSections, setExpandedSections] = useState<
    Record<LedgerSection, boolean>
  >({
    sales: true,
    procurements: false,
    products: false,
    suppliers: false,
  })

  const [editingProductId, setEditingProductId] = useState<
    string | null
  >(null)
  const [editingProductName, setEditingProductName] = useState('')
  const [editingProductCategoryId, setEditingProductCategoryId] =
    useState('')
  const [productMessage, setProductMessage] = useState('')

  const [supplierMessage, setSupplierMessage] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')
  const [saleMessage, setSaleMessage] = useState('')

  useEffect(() => {
    async function loadData() {
      const productRecords = await db.products.toArray()
      setProducts(productRecords)

      const categoryRecords = await db.categories.toArray()
      setCategories(categoryRecords)

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

      const saleRecords = await db.sales
        .orderBy('createdAt')
        .reverse()
        .toArray()

      setSales(saleRecords)
    }

    loadData()
  }, [])

  async function refreshProductsData() {
    const productRecords = await db.products.toArray()

    setProducts(productRecords)

    await onProductsChanged()
  }

  function toggleSection(section: LedgerSection) {
    setExpandedSections((currentSections) => ({
      ...currentSections,
      [section]: !currentSections[section],
    }))
  }

  function expandAllSections() {
    setExpandedSections({
      sales: true,
      procurements: true,
      products: true,
      suppliers: true,
    })
  }

  function collapseAllSections() {
    setExpandedSections({
      sales: false,
      procurements: false,
      products: false,
      suppliers: false,
    })
  }

  function renderSectionHeader(
    section: LedgerSection,
    title: string,
  ) {
    const expanded = expandedSections[section]

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '28px',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom:
            '1px solid var(--color-border-light)',
        }}
      >
        <h2
          style={{
            margin: 0,
            padding: 0,
            borderBottom: 0,
          }}
        >
          {title}
        </h2>

        <button
          onClick={() => toggleSection(section)}
          aria-expanded={expanded}
          style={{
            minHeight: '36px',
            margin: 0,
            padding: '6px 12px',
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    )
  }

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

  function getProductName(productId: string) {
    return (
      products.find(
        (product) => product.id === productId,
      )?.name ?? 'Unknown product'
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

      await refreshProductsData()

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

      await refreshProductsData()

      setProcurementMessage('Procurement voided.')
    } catch (error) {
      if (error instanceof Error) {
        setProcurementMessage(error.message)
        return
      }

      setProcurementMessage('Unable to void procurement.')
    }
  }

  async function refreshSalesData() {
    const saleRecords = await db.sales
      .orderBy('createdAt')
      .reverse()
      .toArray()

    setSales(saleRecords)

    await refreshProductsData()
  }

  async function handleVoidSale(saleId: string) {
    const reason = window.prompt(
      'Enter the reason for voiding this sale:',
    )

    if (reason === null) {
      return
    }

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setSaleMessage('Void reason is required.')
      return
    }

    const confirmed = window.confirm(
      'Void this sale?\n\n' +
        'Use Void when the sale itself was entered in error. The sale will be preserved, stock will be restored, and VOID inventory movements will be created.',
    )

    if (!confirmed) {
      setSaleMessage('Sale void cancelled.')
      return
    }

    try {
      await voidSale(saleId, trimmedReason)
      await refreshSalesData()
      setSaleMessage('Sale voided.')
    } catch (error) {
      if (error instanceof Error) {
        setSaleMessage(error.message)
        return
      }

      setSaleMessage('Unable to void sale.')
    }
  }

  async function handleRefundSale(saleId: string) {
    const reason = window.prompt(
      'Enter the reason for refunding this sale:',
    )

    if (reason === null) {
      return
    }

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setSaleMessage('Refund reason is required.')
      return
    }

    const confirmed = window.confirm(
      'Refund this sale?\n\n' +
        'Use Refund when the original sale was valid but is being reversed afterward. The sale will be preserved, stock will be restored, and REFUND inventory movements will be created.',
    )

    if (!confirmed) {
      setSaleMessage('Sale refund cancelled.')
      return
    }

    try {
      await refundSale(saleId, trimmedReason)
      await refreshSalesData()
      setSaleMessage('Sale refunded.')
    } catch (error) {
      if (error instanceof Error) {
        setSaleMessage(error.message)
        return
      }

      setSaleMessage('Unable to refund sale.')
    }
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0 }}>Data Viewer</h1>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={expandAllSections}
            style={{ margin: 0 }}
          >
            Expand All
          </button>

          <button
            onClick={collapseAllSections}
            style={{ margin: 0 }}
          >
            Collapse All
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: '24px',
          marginBottom: '24px',
        }}
      >
        <InventoryReconciliationPanel
          onProductsChanged={refreshProductsData}
        />
      </div>

      {renderSectionHeader('sales', 'Sales')}

      {expandedSections.sales && (
        <table>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Cash Received</th>
              <th>Change</th>
              <th>Status</th>
              <th>Action</th>
              <th>Reason</th>
            </tr>
          </thead>

          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={8}>No sales recorded.</td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDateTime(sale.createdAt)}</td>

                  <td>
                    {sale.paymentMethod === 'GCASH'
                      ? 'GCash'
                      : 'Cash'}
                  </td>

                  <td>
                    ₱{sale.totalAmount.toFixed(2)}
                  </td>

                  <td>
                    {sale.cashReceived !== undefined
                      ? `₱${sale.cashReceived.toFixed(2)}`
                      : '-'}
                  </td>

                  <td>
                    {sale.changeDue !== undefined
                      ? `₱${sale.changeDue.toFixed(2)}`
                      : '-'}
                  </td>

                  <td>{sale.status}</td>

                  <td>
                    {sale.status === 'VALID' ? (
                      <>
                        <button
                          onClick={() =>
                            handleVoidSale(sale.id)
                          }
                        >
                          Void
                        </button>

                        <button
                          onClick={() =>
                            handleRefundSale(sale.id)
                          }
                        >
                          Refund
                        </button>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>

                  <td>
                    {sale.status === 'VOID'
                      ? sale.voidReason ?? '-'
                      : sale.status === 'REFUNDED'
                        ? sale.refundReason ?? '-'
                        : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {saleMessage && (
        <p
          style={{
            color:
              saleMessage === 'Sale voided.' ||
              saleMessage === 'Sale refunded.'
                ? 'var(--color-success)'
                : 'var(--color-danger)',
            fontWeight: 600,
          }}
        >
          {saleMessage}
        </p>
      )}

      {renderSectionHeader(
        'procurements',
        'Procurements',
      )}

      {expandedSections.procurements && (
        <>
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
                      <td>
                        {procurement.procurementDate}
                      </td>

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
                    getProductName(item.productId)

                  const isFirstItem = index === 0

                  return (
                    <tr key={item.id}>
                      {isFirstItem && (
                        <>
                          <td rowSpan={items.length}>
                            {
                              procurement.procurementDate
                            }
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
        </>
      )}

      {renderSectionHeader('products', 'Products')}

      {expandedSections.products && (
        <>
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
                          value={
                            editingProductCategoryId
                          }
                          onChange={(event) =>
                            setEditingProductCategoryId(
                              event.target.value,
                            )
                          }
                        >
                          <option value="">
                            Select a category
                          </option>

                          {sortedCategories.map(
                            (category) => (
                              <option
                                key={category.id}
                                value={category.id}
                              >
                                {category.name}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        getCategoryName(
                          product.categoryId,
                        )
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
                      ₱
                      {product.sellingPrice.toFixed(
                        2,
                      )}
                    </td>

                    <td>
                      {product.currentStockCache}
                    </td>

                    <td>
                      {product.active
                        ? 'Yes'
                        : 'No'}
                    </td>

                    <td>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() =>
                              handleSaveProduct(
                                product.id,
                              )
                            }
                          >
                            Save
                          </button>

                          <button
                            onClick={
                              handleCancelEditProduct
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            handleStartEditProduct(
                              product,
                            )
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

          {productMessage && (
            <p>{productMessage}</p>
          )}
        </>
      )}

      {renderSectionHeader(
        'suppliers',
        'Suppliers',
      )}

      {expandedSections.suppliers && (
        <>
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

                  <td>
                    {supplier.active
                      ? 'Yes'
                      : 'No'}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        handleDeleteSupplier(
                          supplier.id,
                        )
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {supplierMessage && (
            <p>{supplierMessage}</p>
          )}
        </>
      )}
    </section>
  )
}

export default DataViewer