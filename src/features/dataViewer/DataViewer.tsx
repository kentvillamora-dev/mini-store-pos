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
import { refundSale, voidSale } from '../../services/saleService'

interface DataViewerProps {
  onProductsChanged: () => Promise<void>
  onSuppliersChanged: () => Promise<void>
}

type LedgerSection = 'sales' | 'procurements' | 'products' | 'suppliers'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

function DataViewer({ onProductsChanged, onSuppliersChanged }: DataViewerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [procurements, setProcurements] = useState<Procurement[]>([])
  const [procurementItems, setProcurementItems] = useState<ProcurementItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<LedgerSection, boolean>>({
    sales: true, procurements: false, products: false, suppliers: false,
  })
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingProductName, setEditingProductName] = useState('')
  const [editingProductCategoryId, setEditingProductCategoryId] = useState('')
  const [productMessage, setProductMessage] = useState('')
  const [supplierMessage, setSupplierMessage] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')
  const [saleMessage, setSaleMessage] = useState('')

  async function loadData() {
    const [productRecords, categoryRecords, supplierRecords, procurementRecords, itemRecords, saleRecords] =
      await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
        db.suppliers.toArray(),
        db.procurements.orderBy('createdAt').reverse().toArray(),
        db.procurementItems.toArray(),
        db.sales.orderBy('createdAt').reverse().toArray(),
      ])
    setProducts(productRecords)
    setCategories(categoryRecords)
    setSuppliers(supplierRecords)
    setProcurements(procurementRecords)
    setProcurementItems(itemRecords)
    setSales(saleRecords)
  }

  useEffect(() => { void loadData() }, [])

  async function refreshProductsData() {
    setProducts(await db.products.toArray())
    await onProductsChanged()
  }

  function getCategoryName(categoryId?: string) {
    return categoryId
      ? categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorized'
      : 'Uncategorized'
  }

  function getProductName(productId: string) {
    return products.find((product) => product.id === productId)?.name ?? 'Unknown product'
  }

  const sortedProducts = [...products].sort((a, b) => {
    const categoryCompare = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId), 'en', { sensitivity: 'base' })
    return categoryCompare || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  })

  const sortedCategories = [...categories]
    .filter((category) => category.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

  function renderSectionHeader(section: LedgerSection, title: string) {
    const expanded = expandedSections[section]
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '28px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border-light)' }}>
        <h2 style={{ margin: 0, padding: 0, borderBottom: 0 }}>{title}</h2>
        <button onClick={() => setExpandedSections((current) => ({ ...current, [section]: !current[section] }))} aria-expanded={expanded} style={{ minHeight: '36px', margin: 0, padding: '6px 12px' }}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    )
  }

  async function handleSaveProduct(productId: string) {
    try {
      await updateProduct(productId, editingProductName, editingProductCategoryId)
      await refreshProductsData()
      setEditingProductId(null)
      setEditingProductName('')
      setEditingProductCategoryId('')
      setProductMessage('Product updated.')
    } catch (error) {
      setProductMessage(error instanceof Error ? error.message : 'Unable to update product.')
    }
  }

  async function handleDeleteSupplier(supplierId: string) {
    try {
      await deleteSupplier(supplierId)
      setSuppliers(await db.suppliers.toArray())
      await onSuppliersChanged()
      setSupplierMessage('Supplier deleted.')
    } catch (error) {
      setSupplierMessage(error instanceof Error ? error.message : 'Unable to delete supplier.')
    }
  }

  async function handleVoidProcurement(procurementId: string) {
    const reason = window.prompt('Enter the reason for voiding this procurement:')
    if (reason === null) return
    if (!reason.trim()) { setProcurementMessage('Void reason is required.'); return }
    if (!window.confirm('Void this procurement?\n\nThis will preserve the record and reverse its stock effect.')) return
    try {
      await voidProcurement(procurementId, reason)
      await loadData()
      await onProductsChanged()
      setProcurementMessage('Procurement voided.')
    } catch (error) {
      setProcurementMessage(error instanceof Error ? error.message : 'Unable to void procurement.')
    }
  }

  async function handleSaleReversal(saleId: string, mode: 'VOID' | 'REFUND') {
    const reason = window.prompt(`Enter the reason for ${mode === 'VOID' ? 'voiding' : 'refunding'} this sale:`)
    if (reason === null) return
    if (!reason.trim()) { setSaleMessage(`${mode === 'VOID' ? 'Void' : 'Refund'} reason is required.`); return }
    if (!window.confirm(`${mode === 'VOID' ? 'Void' : 'Refund'} this sale?`)) return
    try {
      if (mode === 'VOID') await voidSale(saleId, reason)
      else await refundSale(saleId, reason)
      await loadData()
      await onProductsChanged()
      setSaleMessage(mode === 'VOID' ? 'Sale voided.' : 'Sale refunded.')
    } catch (error) {
      setSaleMessage(error instanceof Error ? error.message : `Unable to ${mode.toLowerCase()} sale.`)
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Data Viewer</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setExpandedSections({ sales: true, procurements: true, products: true, suppliers: true })}>Expand All</button>
          <button onClick={() => setExpandedSections({ sales: false, procurements: false, products: false, suppliers: false })}>Collapse All</button>
        </div>
      </div>

      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <InventoryReconciliationPanel onProductsChanged={refreshProductsData} />
      </div>

      {renderSectionHeader('sales', 'Sales')}
      {expandedSections.sales && (
        <table>
          <thead><tr><th>Date / Time</th><th>Payment</th><th>Total</th><th>Cash Received</th><th>Change</th><th>Status</th><th>Action</th><th>Reason</th></tr></thead>
          <tbody>
            {sales.length === 0 ? <tr><td colSpan={8}>No sales recorded.</td></tr> : sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDateTime(sale.createdAt)}</td><td>{sale.paymentMethod === 'GCASH' ? 'GCash' : 'Cash'}</td>
                <td>₱{sale.totalAmount.toFixed(2)}</td><td>{sale.cashReceived !== undefined ? `₱${sale.cashReceived.toFixed(2)}` : '-'}</td>
                <td>{sale.changeDue !== undefined ? `₱${sale.changeDue.toFixed(2)}` : '-'}</td><td>{sale.status}</td>
                <td>{sale.status === 'VALID' ? <><button onClick={() => void handleSaleReversal(sale.id, 'VOID')}>Void</button><button onClick={() => void handleSaleReversal(sale.id, 'REFUND')}>Refund</button></> : '-'}</td>
                <td>{sale.status === 'VOID' ? sale.voidReason ?? '-' : sale.status === 'REFUNDED' ? sale.refundReason ?? '-' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {saleMessage && <p>{saleMessage}</p>}

      {renderSectionHeader('procurements', 'Procurements')}
      {expandedSections.procurements && (
        <>
          <table>
            <thead><tr><th>Date</th><th>Source</th><th>Item</th><th>Quantity</th><th>Total Cost</th><th>Unit Cost</th><th>Previous Price</th><th>SRP</th><th>Applied Price</th><th>Status</th><th>Action</th><th>Void Reason</th></tr></thead>
            <tbody>
              {procurements.flatMap((procurement) => {
                const items = procurementItems.filter((item) => item.procurementId === procurement.id)
                const isOpening = procurement.procurementType === 'OPENING_INVENTORY'
                const sourceName = isOpening
                  ? 'Opening Inventory'
                  : procurement.supplierId
                    ? suppliers.find((supplier) => supplier.id === procurement.supplierId)?.name ?? 'Unknown supplier'
                    : '-'

                if (items.length === 0) {
                  return [<tr key={procurement.id}><td>{procurement.procurementDate}</td><td>{sourceName}</td><td colSpan={7}>No procurement items found</td><td>{procurement.status}</td><td>{procurement.status === 'VALID' ? <button onClick={() => void handleVoidProcurement(procurement.id)}>Void</button> : '-'}</td><td>{procurement.voidReason ?? 'N/A'}</td></tr>]
                }

                return items.map((item, index) => (
                  <tr key={item.id}>
                    {index === 0 && <><td rowSpan={items.length}>{procurement.procurementDate}</td><td rowSpan={items.length}>{sourceName}</td></>}
                    <td>{getProductName(item.productId)}</td><td>{item.quantity}</td>
                    <td>{isOpening ? '—' : `₱${item.totalCost.toFixed(2)}`}</td>
                    <td>{isOpening ? '—' : `₱${item.unitCost.toFixed(2)}`}</td>
                    <td>{item.previousSellingPrice !== undefined && item.previousSellingPrice > 0 ? `₱${item.previousSellingPrice.toFixed(2)}` : '-'}</td>
                    <td>{isOpening ? '—' : `₱${item.suggestedSellingPrice.toFixed(2)}`}</td>
                    <td>{item.appliedSellingPrice !== undefined ? `₱${item.appliedSellingPrice.toFixed(2)}` : '-'}</td>
                    {index === 0 && <><td rowSpan={items.length}>{procurement.status}</td><td rowSpan={items.length}>{procurement.status === 'VALID' ? <button onClick={() => void handleVoidProcurement(procurement.id)}>Void</button> : '-'}</td><td rowSpan={items.length}>{procurement.voidReason ?? 'N/A'}</td></>}
                  </tr>
                ))
              })}
            </tbody>
          </table>
          {procurementMessage && <p>{procurementMessage}</p>}
        </>
      )}

      {renderSectionHeader('products', 'Products')}
      {expandedSections.products && (
        <>
          <table>
            <thead><tr><th>Category</th><th>Product</th><th>Selling Price</th><th>Stock Cache</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>
              {sortedProducts.map((product) => {
                const editing = editingProductId === product.id
                return <tr key={product.id}>
                  <td>{editing ? <select value={editingProductCategoryId} onChange={(event) => setEditingProductCategoryId(event.target.value)}><option value="">Select a category</option>{sortedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select> : getCategoryName(product.categoryId)}</td>
                  <td>{editing ? <input value={editingProductName} onChange={(event) => setEditingProductName(event.target.value)} /> : product.name}</td>
                  <td>₱{product.sellingPrice.toFixed(2)}</td><td>{product.currentStockCache}</td><td>{product.active ? 'Yes' : 'No'}</td>
                  <td>{editing ? <><button onClick={() => void handleSaveProduct(product.id)}>Save</button><button onClick={() => { setEditingProductId(null); setProductMessage('') }}>Cancel</button></> : <button onClick={() => { setEditingProductId(product.id); setEditingProductName(product.name); setEditingProductCategoryId(product.categoryId ?? ''); setProductMessage('') }}>Edit</button>}</td>
                </tr>
              })}
            </tbody>
          </table>
          {productMessage && <p>{productMessage}</p>}
        </>
      )}

      {renderSectionHeader('suppliers', 'Suppliers')}
      {expandedSections.suppliers && (
        <>
          <table><thead><tr><th>Name</th><th>Active</th><th>Action</th></tr></thead><tbody>
            {suppliers.map((supplier) => <tr key={supplier.id}><td>{supplier.name}</td><td>{supplier.active ? 'Yes' : 'No'}</td><td><button onClick={() => void handleDeleteSupplier(supplier.id)}>Delete</button></td></tr>)}
          </tbody></table>
          {supplierMessage && <p>{supplierMessage}</p>}
        </>
      )}
    </section>
  )
}

export default DataViewer
