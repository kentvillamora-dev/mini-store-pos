import { useEffect, useState } from 'react'
import { db, type Category, type Product, type Supplier, type ProcurementType } from './db/database'
import DataViewer from './features/dataViewer/DataViewer'
import UpdatePrompt from './features/pwa/UpdatePrompt'
import { initializeDefaultCategories } from './services/categoryService'
import { createProduct } from './services/productService'
import {
  calculateProcurementValues,
  createProcurement,
  findPotentialDuplicateProcurement,
  getLatestValidProcurementForProduct,
  type LatestValidProcurementForProduct,
  type ProcurementItemInput,
} from './services/procurementService'
import { setProductPrice } from './services/priceService'
import { createSale } from './services/saleService'
import { createSupplier } from './services/supplierService'

type AppPage = 'pos' | 'procurement' | 'ledgers'
type ProcurementStage = 'idle' | 'details'
type PaymentMethod = 'CASH' | 'GCASH'

interface CartItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION
const OPENING_INVENTORY_VALUE = '__OPENING_INVENTORY__'
const CATEGORY_DISPLAY_ORDER = [
  'Snacks', 'Beverages', 'Milk and Coffee', 'Cooking Essentials', 'Canned Goods',
  'Instant Noodles', 'Household Cleaning', 'Personal Care', 'Cigarettes', 'Miscellaneous',
]

function getTodayDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [currentPage, setCurrentPage] = useState<AppPage>('pos')

  const [productName, setProductName] = useState('')
  const [productCategoryId, setProductCategoryId] = useState('')
  const [productMessage, setProductMessage] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierMessage, setSupplierMessage] = useState('')

  const [procurementStage, setProcurementStage] = useState<ProcurementStage>('idle')
  const [procurementType, setProcurementType] = useState<ProcurementType>('PURCHASE')
  const [procurementSupplierId, setProcurementSupplierId] = useState('')
  const [procurementDate, setProcurementDate] = useState('')
  const [procurementItems, setProcurementItems] = useState<ProcurementItemInput[]>([])
  const [procurementProductSearch, setProcurementProductSearch] = useState('')
  const [activeProcurementProductId, setActiveProcurementProductId] = useState<string | null>(null)
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemTotalCost, setItemTotalCost] = useState('')
  const [itemSellingPrice, setItemSellingPrice] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')
  const [focusedProcurementCategoryId, setFocusedProcurementCategoryId] = useState<string | null>(null)
  const [showInlineSupplier, setShowInlineSupplier] = useState(false)
  const [inlineSupplierName, setInlineSupplierName] = useState('')
  const [showInlineProduct, setShowInlineProduct] = useState(false)
  const [inlineProductCategoryId, setInlineProductCategoryId] = useState('')
  const [inlineProductName, setInlineProductName] = useState('')
  const [inlineProductQuantity, setInlineProductQuantity] = useState('')
  const [inlineProductTotalCost, setInlineProductTotalCost] = useState('')
  const [inlineProductSellingPrice, setInlineProductSellingPrice] = useState('')

  const [priceProductId, setPriceProductId] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [priceMessage, setPriceMessage] = useState('')
  const [latestPriceReference, setLatestPriceReference] = useState<LatestValidProcurementForProduct | null>(null)

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartMessage, setCartMessage] = useState('')
  const [cartMessageProductId, setCartMessageProductId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [saleMessage, setSaleMessage] = useState('')
  const [focusedPosCategoryId, setFocusedPosCategoryId] = useState<string | null>(null)

  const orderedCategories = [...categories].sort((a, b) => {
    const ai = CATEGORY_DISPLAY_ORDER.indexOf(a.name)
    const bi = CATEGORY_DISPLAY_ORDER.indexOf(b.name)
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const orderedSuppliers = [...suppliers].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const activeProducts = products.filter((product) => product.active)
  const categorizedProducts = orderedCategories.filter((category) => category.active).map((category) => ({
    category,
    products: activeProducts.filter((product) => product.categoryId === category.id).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
  })).filter((group) => group.products.length > 0)
  const uncategorizedProducts = activeProducts.filter((product) => !product.categoryId || !categories.some((category) => category.id === product.categoryId)).sort((a, b) => a.name.localeCompare(b.name))
  const normalizedSearch = procurementProductSearch.trim().toLocaleLowerCase()
  const procurementProductGroups = orderedCategories.filter((category) => category.active).map((category) => ({
    category,
    products: activeProducts.filter((product) => product.categoryId === category.id && (!normalizedSearch || product.name.toLocaleLowerCase().includes(normalizedSearch))).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.products.length > 0)
  const procurementUncategorizedProducts = activeProducts.filter((product) => {
    const categoryExists = product.categoryId ? categories.some((category) => category.id === product.categoryId) : false
    return !categoryExists && (!normalizedSearch || product.name.toLocaleLowerCase().includes(normalizedSearch))
  }).sort((a, b) => a.name.localeCompare(b.name))

  const isOpeningInventory = procurementType === 'OPENING_INVENTORY'
  const procurementTotal = procurementItems.reduce((total, item) => total + item.totalCost, 0)
  const procurementTotalQuantity = procurementItems.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cartItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
  const cashReceivedAmount = Number(cashReceived)
  const changeDue = Number.isFinite(cashReceivedAmount) && cashReceivedAmount >= cartTotal ? cashReceivedAmount - cartTotal : 0
  const remainingAmount = Number.isFinite(cashReceivedAmount) && cashReceivedAmount > 0 && cashReceivedAmount < cartTotal ? cartTotal - cashReceivedAmount : 0
  const canCompleteSale = cartItems.length > 0 && (paymentMethod === 'GCASH' || (Number.isFinite(cashReceivedAmount) && cashReceivedAmount >= cartTotal))
  const priceProduct = products.find((product) => product.id === priceProductId) ?? null
  const latestPriceSupplier = latestPriceReference?.procurement.supplierId
    ? suppliers.find((supplier) => supplier.id === latestPriceReference.procurement.supplierId) ?? null
    : null

  useEffect(() => {
    async function loadData() {
      await initializeDefaultCategories()
      setProducts(await db.products.toArray())
      setCategories(await db.categories.toArray())
      setSuppliers(await db.suppliers.toArray())
    }
    void loadData()
  }, [])

  async function refreshProducts() { setProducts(await db.products.toArray()) }
  async function refreshSuppliers() { setSuppliers(await db.suppliers.toArray()) }

  function getDisplayedStock(product: Product) {
    const cartItem = cartItems.find((item) => item.productId === product.id)
    return Math.max(0, product.currentStockCache - (cartItem?.quantity ?? 0))
  }

  function handlePosCategoryJump(categoryId: string) {
    const section = document.getElementById(`pos-category-${categoryId}`)
    const nav = document.getElementById('pos-category-navigation')
    const panel = document.querySelector('.products-panel')
    if (!section || !nav || !(panel instanceof HTMLElement)) return
    setFocusedPosCategoryId(categoryId)
    panel.scrollTo({ top: Math.max(0, panel.scrollTop + section.getBoundingClientRect().top - panel.getBoundingClientRect().top - nav.getBoundingClientRect().height - 10), behavior: 'instant' })
  }

  function handleProcurementCategoryJump(categoryId: string) {
    const section = document.getElementById(`procurement-category-${categoryId}`)
    const panel = document.querySelector('.procurement-selection-panel')
    const toolbar = document.querySelector('.procurement-selection-toolbar')
    if (!section || !(panel instanceof HTMLElement) || !(toolbar instanceof HTMLElement)) return
    setFocusedProcurementCategoryId(categoryId)
    panel.scrollTo({ top: Math.max(0, panel.scrollTop + section.getBoundingClientRect().top - panel.getBoundingClientRect().top - toolbar.getBoundingClientRect().height - 10), behavior: 'instant' })
  }

  function resetProcurementEntryFields() {
    setActiveProcurementProductId(null)
    setItemQuantity('')
    setItemTotalCost('')
    setItemSellingPrice('')
  }

  function resetInlineProduct() {
    setShowInlineProduct(false)
    setInlineProductCategoryId('')
    setInlineProductName('')
    setInlineProductQuantity('')
    setInlineProductTotalCost('')
    setInlineProductSellingPrice('')
  }

  function resetProcurementDraft() {
    setProcurementStage('idle')
    setProcurementType('PURCHASE')
    setProcurementSupplierId('')
    setProcurementDate('')
    setProcurementItems([])
    setProcurementProductSearch('')
    resetProcurementEntryFields()
    setFocusedProcurementCategoryId(null)
    setShowInlineSupplier(false)
    setInlineSupplierName('')
    resetInlineProduct()
  }

  function handleStartNewProcurement() {
    resetProcurementDraft()
    setProcurementDate(getTodayDate())
    setProcurementStage('details')
    setProcurementMessage('')
  }

  function handleSourceChange(value: string) {
    if (value === OPENING_INVENTORY_VALUE) {
      setProcurementType('OPENING_INVENTORY')
      setProcurementSupplierId('')
      setProcurementItems((items) => items.map((item) => ({ ...item, totalCost: 0 })))
      setItemTotalCost('')
      setInlineProductTotalCost('')
    } else {
      setProcurementType('PURCHASE')
      setProcurementSupplierId(value)
    }
    setProcurementMessage('')
  }

  function handleSelectProcurementProduct(productId: string) {
    const product = products.find((candidate) => candidate.id === productId)
    if (!product) { setProcurementMessage('Product was not found.'); return }
    const existing = procurementItems.find((item) => item.productId === productId)
    setActiveProcurementProductId(productId)
    setItemQuantity(existing ? String(existing.quantity) : '')
    setItemTotalCost(existing && !isOpeningInventory ? String(existing.totalCost) : '')
    setItemSellingPrice(existing?.appliedSellingPrice !== undefined ? String(existing.appliedSellingPrice) : product.sellingPrice > 0 ? String(product.sellingPrice) : '')
    setProcurementMessage('')
  }

  function handleAddProcurementItem() {
    if (!activeProcurementProductId) return
    const product = products.find((candidate) => candidate.id === activeProcurementProductId)
    if (!product) { setProcurementMessage('Product was not found.'); return }
    const quantity = Number(itemQuantity)
    const totalCost = isOpeningInventory ? 0 : Number(itemTotalCost)
    const sellingPrice = Number(itemSellingPrice)
    if (!Number.isInteger(quantity) || quantity <= 0) { setProcurementMessage(`${product.name}: quantity must be a whole number greater than zero.`); return }
    if (!isOpeningInventory && (!Number.isFinite(totalCost) || totalCost <= 0)) { setProcurementMessage(`${product.name}: total cost must be greater than zero.`); return }
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) { setProcurementMessage(`${product.name}: selling price must be greater than zero.`); return }
    const nextItem: ProcurementItemInput = { productId: product.id, quantity, totalCost, appliedSellingPrice: sellingPrice }
    setProcurementItems((items) => items.some((item) => item.productId === product.id) ? items.map((item) => item.productId === product.id ? nextItem : item) : [...items, nextItem])
    resetProcurementEntryFields()
    setProcurementMessage('')
  }

  async function handleInlineAddProduct() {
    const quantity = Number(inlineProductQuantity)
    const totalCost = isOpeningInventory ? 0 : Number(inlineProductTotalCost)
    const sellingPrice = Number(inlineProductSellingPrice)
    if (!inlineProductCategoryId) { setProcurementMessage('Select a category for the new product.'); return }
    if (!inlineProductName.trim()) { setProcurementMessage('Product name is required.'); return }
    if (!Number.isInteger(quantity) || quantity <= 0) { setProcurementMessage('Quantity must be a whole number greater than zero.'); return }
    if (!isOpeningInventory && (!Number.isFinite(totalCost) || totalCost <= 0)) { setProcurementMessage('Total cost must be greater than zero.'); return }
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) { setProcurementMessage('Selling price must be greater than zero.'); return }

    try {
      const newProduct = await createProduct(inlineProductName, inlineProductCategoryId)
      await refreshProducts()
      setProcurementItems((items) => [...items, { productId: newProduct.id, quantity, totalCost, appliedSellingPrice: sellingPrice }])
      resetInlineProduct()
      setProcurementProductSearch('')
      setProcurementMessage(`${newProduct.name} added to this ${isOpeningInventory ? 'opening inventory' : 'procurement'}.`)
    } catch (error) {
      setProcurementMessage(error instanceof Error ? error.message : 'Unable to add product.')
    }
  }

  async function handleInlineAddSupplier() {
    try {
      const supplier = await createSupplier(inlineSupplierName)
      await refreshSuppliers()
      setProcurementType('PURCHASE')
      setProcurementSupplierId(supplier.id)
      setInlineSupplierName('')
      setShowInlineSupplier(false)
      setProcurementMessage(`${supplier.name} added and selected.`)
    } catch (error) {
      setProcurementMessage(error instanceof Error ? error.message : 'Unable to add supplier.')
    }
  }

  async function handleSaveProcurement() {
    if (!procurementDate) { setProcurementMessage('Procurement date is required.'); return }
    if (!isOpeningInventory && !procurementSupplierId) { setProcurementMessage('Supplier is required.'); return }
    if (activeProcurementProductId || showInlineProduct) { setProcurementMessage('Finish or cancel the active product entry before saving.'); return }
    if (procurementItems.length === 0) { setProcurementMessage('Add at least one product before saving.'); return }

    const input = {
      procurementType,
      supplierId: isOpeningInventory ? undefined : procurementSupplierId,
      procurementDate,
      items: procurementItems,
    }

    try {
      const duplicate = await findPotentialDuplicateProcurement(input)
      if (duplicate && !window.confirm(`A similar ${isOpeningInventory ? 'opening inventory' : 'procurement'} has already been recorded for ${duplicate.procurementDate}. Save another valid record?`)) {
        setProcurementMessage('Procurement cancelled.')
        return
      }
      await createProcurement(input)
      await refreshProducts()
      resetProcurementDraft()
      setProcurementMessage(isOpeningInventory ? 'Opening inventory saved.' : 'Procurement saved.')
    } catch (error) {
      setProcurementMessage(error instanceof Error ? error.message : 'Unable to save procurement.')
    }
  }

  async function handleCreateProduct() {
    try { await createProduct(productName, productCategoryId); await refreshProducts(); setProductName(''); setProductMessage('Product created.') }
    catch (error) { setProductMessage(error instanceof Error ? error.message : 'Unable to create product.') }
  }

  async function handleCreateSupplier() {
    try { await createSupplier(supplierName); await refreshSuppliers(); setSupplierName(''); setSupplierMessage('Supplier created.') }
    catch (error) { setSupplierMessage(error instanceof Error ? error.message : 'Unable to create supplier.') }
  }

  async function handlePriceProductChange(productId: string) {
    setPriceProductId(productId); setNewSellingPrice(''); setPriceMessage(''); setLatestPriceReference(null)
    if (productId) setLatestPriceReference(await getLatestValidProcurementForProduct(productId) ?? null)
  }

  async function handleSetProductPrice() {
    try {
      await setProductPrice({ productId: priceProductId, newPrice: Number(newSellingPrice), procurementId: latestPriceReference?.procurement.id, reason: 'Manual price update' })
      await refreshProducts(); setNewSellingPrice(''); setPriceMessage('Selling price updated.')
    } catch (error) { setPriceMessage(error instanceof Error ? error.message : 'Unable to update selling price.') }
  }

  function setProductCartMessage(productId: string | null, message: string) { setCartMessageProductId(productId); setCartMessage(message) }
  function handleAddProductToCart(product: Product) {
    setProductCartMessage(null, '')
    if (product.sellingPrice <= 0) { setProductCartMessage(product.id, `${product.name} does not have a selling price yet.`); return }
    if (getDisplayedStock(product) <= 0) { setProductCartMessage(product.id, `${product.name} is out of stock.`); return }
    setCartItems((items) => {
      const existing = items.find((item) => item.productId === product.id)
      return existing ? items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { productId: product.id, productName: product.name, unitPrice: product.sellingPrice, quantity: 1 }]
    })
  }
  function handleIncreaseCartQuantity(productId: string) {
    const product = products.find((candidate) => candidate.id === productId)
    if (!product || getDisplayedStock(product) <= 0) { if (product) setProductCartMessage(product.id, `${product.name} is out of stock.`); return }
    setCartItems((items) => items.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item))
  }
  function handleDecreaseCartQuantity(productId: string) { setCartItems((items) => items.flatMap((item) => item.productId !== productId ? [item] : item.quantity <= 1 ? [] : [{ ...item, quantity: item.quantity - 1 }])) }
  function handleClearCart() { setCartItems([]); setProductCartMessage(null, ''); setPaymentMethod('CASH'); setCashReceived(''); setSaleMessage('') }
  async function handleCompleteSale() {
    if (!canCompleteSale) return
    try {
      await createSale({ paymentMethod, cashReceived: paymentMethod === 'CASH' ? cashReceivedAmount : undefined, items: cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })) })
      await refreshProducts(); handleClearCart(); setSaleMessage('Sale completed.')
    } catch (error) { setSaleMessage(error instanceof Error ? error.message : 'Unable to complete sale.') }
  }

  function renderProcurementWorkflow() {
    if (procurementStage === 'idle') return <section><h2>Add Procurement</h2><button onClick={handleStartNewProcurement}>Add Procurement</button>{procurementMessage && <p>{procurementMessage}</p>}</section>

    const columns = 'minmax(300px, 2.6fr) minmax(90px, .7fr) minmax(120px, 1fr) minmax(105px, .8fr) minmax(105px, .8fr) minmax(135px, 1fr) minmax(130px, 1fr)'
    const dash = <span style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>—</span>

    const renderProduct = (product: Product) => {
      const added = procurementItems.find((item) => item.productId === product.id)
      const active = activeProcurementProductId === product.id
      const quantity = Number(itemQuantity)
      const totalCost = Number(itemTotalCost)
      const activeCalc = !isOpeningInventory && active && quantity > 0 && totalCost > 0 ? calculateProcurementValues(quantity, totalCost) : null
      const addedCalc = added && !isOpeningInventory ? calculateProcurementValues(added.quantity, added.totalCost) : null
      return <div key={product.id} style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'center', gap: '8px', minWidth: '1180px', minHeight: '58px', padding: '7px 10px', marginBottom: '6px', border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', background: active ? 'var(--color-primary-light)' : added ? 'var(--color-background-soft)' : '#fff' }}>
        <strong>{product.name}</strong>
        {active ? <>
          <input type="number" min="1" step="1" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} placeholder="Qty" />
          {isOpeningInventory ? dash : <input type="number" min="0.01" step="0.01" value={itemTotalCost} onChange={(event) => setItemTotalCost(event.target.value)} placeholder="0.00" />}
          {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>{activeCalc ? `₱${activeCalc.unitCost.toFixed(2)}` : '—'}</strong>}
          {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>{activeCalc ? `₱${activeCalc.suggestedSellingPrice.toFixed(2)}` : '—'}</strong>}
          <input type="number" min="0.01" step="0.01" value={itemSellingPrice} onChange={(event) => setItemSellingPrice(event.target.value)} placeholder="Selling Price" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}><button onClick={resetProcurementEntryFields}>Cancel</button><button className="procurement-primary-button" onClick={handleAddProcurementItem}>{added ? 'Update' : 'Add'}</button></div>
        </> : added ? <>
          <strong style={{ textAlign: 'right' }}>{added.quantity}</strong>
          {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>₱{added.totalCost.toFixed(2)}</strong>}
          {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>₱{addedCalc?.unitCost.toFixed(2)}</strong>}
          {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>₱{addedCalc?.suggestedSellingPrice.toFixed(2)}</strong>}
          <strong style={{ textAlign: 'right' }}>₱{(added.appliedSellingPrice ?? 0).toFixed(2)}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}><button onClick={() => handleSelectProcurementProduct(product.id)}>Edit</button><button onClick={() => setProcurementItems((items) => items.filter((item) => item.productId !== product.id))}>Remove</button></div>
        </> : <>{dash}{dash}{dash}{dash}<span style={{ textAlign: 'right' }}>{product.sellingPrice > 0 ? `Current ₱${product.sellingPrice.toFixed(2)}` : '—'}</span><button onClick={() => handleSelectProcurementProduct(product.id)}>Select</button></>}
      </div>
    }

    const inlineQuantity = Number(inlineProductQuantity)
    const inlineTotalCostNumber = Number(inlineProductTotalCost)
    const inlineCalc = !isOpeningInventory && inlineQuantity > 0 && inlineTotalCostNumber > 0 ? calculateProcurementValues(inlineQuantity, inlineTotalCostNumber) : null

    return <section className="procurement-active-workflow" style={{ padding: '12px' }}>
      <section className="procurement-selection-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowX: 'auto' }}>
        <div className="procurement-selection-toolbar" style={{ padding: '10px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(155px,.7fr) minmax(280px,1.2fr) minmax(230px,1.3fr)', alignItems: 'end', gap: '8px', marginBottom: '8px' }}>
            <label style={{ margin: 0 }}>Date<input type="date" value={procurementDate} onChange={(event) => setProcurementDate(event.target.value)} style={{ marginTop: '4px' }} /></label>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontWeight: 600 }}>Supplier / Source</span><button onClick={() => setShowInlineSupplier((value) => !value)} style={{ minHeight: '28px', margin: 0, padding: '3px 8px', fontSize: '.75rem' }}>+ Add</button></div>
              <select value={isOpeningInventory ? OPENING_INVENTORY_VALUE : procurementSupplierId} onChange={(event) => handleSourceChange(event.target.value)} style={{ margin: 0 }}>
                <option value="">Select a supplier</option><option value={OPENING_INVENTORY_VALUE}>Opening Inventory</option>
                {orderedSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </div>
            <input type="search" aria-label="Search products" value={procurementProductSearch} onChange={(event) => { setProcurementProductSearch(event.target.value); setFocusedProcurementCategoryId(null) }} placeholder="Search products..." style={{ margin: 0 }} />
          </div>

          {showInlineSupplier && <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}><input value={inlineSupplierName} onChange={(event) => setInlineSupplierName(event.target.value)} placeholder="Supplier name" style={{ margin: 0 }} /><button className="procurement-primary-button" onClick={() => void handleInlineAddSupplier()} style={{ margin: 0 }}>Add Supplier</button><button onClick={() => { setShowInlineSupplier(false); setInlineSupplierName('') }} style={{ margin: 0 }}>Cancel</button></div>}

          <div className="procurement-category-navigation" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: '7px', marginBottom: '9px' }}>
            {orderedCategories.filter((category) => category.active).map((category) => <button className={`procurement-category-button ${focusedProcurementCategoryId === category.id ? 'active' : ''}`} key={category.id} onClick={() => handleProcurementCategoryJump(category.id)} title={category.name} style={{ width: '100%', minHeight: '38px', margin: 0, padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</button>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: columns, gap: '8px', minWidth: '1180px', padding: '7px 10px', background: '#eef0f3', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-sm)', fontSize: '.72rem', fontWeight: 750, textTransform: 'uppercase' }}>
            <span>Product</span><span>Quantity</span><span>Total Cost</span><span>Unit Cost</span><span>SRP</span><span>Selling Price</span><span>Action</span>
          </div>
        </div>

        <div className="procurement-receipt-product-list" style={{ minWidth: '1208px' }}>
          {procurementProductGroups.map(({ category, products: groupProducts }) => <section id={`procurement-category-${category.id}`} className="procurement-receipt-category" key={category.id}><h4>{category.name}</h4>{groupProducts.map(renderProduct)}</section>)}
          {procurementUncategorizedProducts.length > 0 && <section id="procurement-category-uncategorized" className="procurement-receipt-category"><h4>Uncategorized</h4>{procurementUncategorizedProducts.map(renderProduct)}</section>}
          {procurementProductGroups.length === 0 && procurementUncategorizedProducts.length === 0 && <p>{activeProducts.length === 0 ? 'No products have been added yet.' : 'No products match your search.'}</p>}

          {showInlineProduct ? <div style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'center', gap: '8px', minWidth: '1180px', padding: '8px 10px', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-light)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(140px,1fr)', gap: '6px' }}><select value={inlineProductCategoryId} onChange={(event) => setInlineProductCategoryId(event.target.value)}><option value="">Select Category</option>{orderedCategories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input value={inlineProductName} onChange={(event) => setInlineProductName(event.target.value)} placeholder="Type product name..." /></div>
            <input type="number" min="1" step="1" value={inlineProductQuantity} onChange={(event) => setInlineProductQuantity(event.target.value)} placeholder="QTY" />
            {isOpeningInventory ? dash : <input type="number" min="0.01" step="0.01" value={inlineProductTotalCost} onChange={(event) => setInlineProductTotalCost(event.target.value)} placeholder="TOT_COST" />}
            {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>{inlineCalc ? `₱${inlineCalc.unitCost.toFixed(2)}` : '—'}</strong>}
            {isOpeningInventory ? dash : <strong style={{ textAlign: 'right' }}>{inlineCalc ? `₱${inlineCalc.suggestedSellingPrice.toFixed(2)}` : '—'}</strong>}
            <input type="number" min="0.01" step="0.01" value={inlineProductSellingPrice} onChange={(event) => setInlineProductSellingPrice(event.target.value)} placeholder="Selling Price" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}><button className="procurement-primary-button" onClick={() => void handleInlineAddProduct()}>Add</button><button onClick={resetInlineProduct}>Cancel</button></div>
          </div> : <button onClick={() => { resetProcurementEntryFields(); setShowInlineProduct(true); setProcurementMessage('') }} style={{ marginTop: '8px' }}>+ Add Product</button>}
        </div>
      </section>

      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: '14px', marginTop: '10px', padding: '10px 12px', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
        <div><div style={{ display: 'flex', gap: '18px', fontSize: '.82rem' }}><span><strong>{procurementItems.length}</strong> Products</span><span><strong>{procurementTotalQuantity}</strong> Total Qty</span><span><strong>{isOpeningInventory ? '—' : `₱${procurementTotal.toFixed(2)}`}</strong> Total Procurement</span></div>{procurementMessage && <p className="procurement-message" style={{ margin: '6px 0 0' }}>{procurementMessage}</p>}</div>
        <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => { resetProcurementDraft(); setProcurementMessage('') }}>Cancel Procurement</button><button className="procurement-primary-button" onClick={() => void handleSaveProcurement()}>{isOpeningInventory ? 'Save Opening Inventory' : 'Save Procurement'}</button></div>
      </div>
    </section>
  }

  function renderCurrentPage() {
    if (currentPage === 'procurement') return <main className={procurementStage === 'details' ? 'procurement-page-active' : undefined}>
      {procurementStage === 'idle' && <h1>Procurement</h1>}{renderProcurementWorkflow()}
      {procurementStage === 'idle' && <>
        <section><h2>Add Product</h2><label>Product Name<input value={productName} onChange={(event) => setProductName(event.target.value)} /></label><fieldset className="category-selector"><legend>Category</legend><div className="category-options">{orderedCategories.filter((category) => category.active).map((category) => <label key={category.id} className={`category-option ${productCategoryId === category.id ? 'selected' : ''}`}><input type="radio" name="product-category" value={category.id} checked={productCategoryId === category.id} onChange={(event) => setProductCategoryId(event.target.value)} /><span>{category.name}</span></label>)}</div></fieldset><button onClick={() => void handleCreateProduct()}>Add Product</button>{productMessage && <p>{productMessage}</p>}</section>
        <section><h2>Add Supplier</h2><label>Supplier Name<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} /></label><button onClick={() => void handleCreateSupplier()}>Add Supplier</button>{supplierMessage && <p>{supplierMessage}</p>}</section>
        <section><h2>Set Price</h2><label>Product<select value={priceProductId} onChange={(event) => void handlePriceProductChange(event.target.value)}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>{priceProduct && <><p>Current Selling Price: {priceProduct.sellingPrice > 0 ? `₱${priceProduct.sellingPrice.toFixed(2)}` : 'Not set'}</p>{latestPriceReference ? <><h3>Latest Procurement</h3><p>Date: {latestPriceReference.procurement.procurementDate}</p><p>Supplier: {latestPriceSupplier?.name ?? 'Unknown supplier'}</p><p>Unit Cost: ₱{latestPriceReference.item.unitCost.toFixed(2)}</p><p>Suggested SRP: ₱{latestPriceReference.item.suggestedSellingPrice.toFixed(2)}</p></> : <p>No valid purchase history found.</p>}</>}<label>New Selling Price<input type="number" min="0.01" step="0.01" value={newSellingPrice} onChange={(event) => setNewSellingPrice(event.target.value)} /></label><button onClick={() => void handleSetProductPrice()}>Set Price</button>{priceMessage && <p>{priceMessage}</p>}</section>
      </>}
    </main>

    if (currentPage === 'ledgers') return <main><DataViewer onProductsChanged={refreshProducts} onSuppliersChanged={refreshSuppliers} /></main>

    return <main className="pos-layout">
      <section className="products-panel">
        <div id="pos-category-navigation" aria-label="Product categories" style={{ position: 'sticky', top: 0, zIndex: 30, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px', padding: '10px 20px', background: 'rgba(249,250,251,.98)' }}>
          {categorizedProducts.map(({ category }) => <button key={category.id} onClick={() => handlePosCategoryJump(category.id)} style={{ background: focusedPosCategoryId === category.id ? 'var(--color-primary)' : 'var(--color-surface)', color: focusedPosCategoryId === category.id ? '#fff' : 'var(--color-text)' }}>{category.name}</button>)}
        </div>
        <div className="products-content">{categorizedProducts.map(({ category, products: groupProducts }) => <section id={`pos-category-${category.id}`} key={category.id}><h2>{category.name}</h2>{groupProducts.map((product) => <button className="product-button" key={product.id} onClick={() => handleAddProductToCart(product)}>{product.name}<span>{product.sellingPrice > 0 ? `₱${product.sellingPrice.toFixed(2)}` : 'Price not set'}</span><span>Stock: {getDisplayedStock(product)}</span></button>)}</section>)}{uncategorizedProducts.length > 0 && <section id="pos-category-uncategorized"><h2>Uncategorized</h2>{uncategorizedProducts.map((product) => <button className="product-button" key={product.id} onClick={() => handleAddProductToCart(product)}>{product.name}<span>{product.sellingPrice > 0 ? `₱${product.sellingPrice.toFixed(2)}` : 'Price not set'}</span><span>Stock: {getDisplayedStock(product)}</span></button>)}</section>}</div>
      </section>
      <section className="cart-panel"><h1>Cart</h1>{cartItems.length === 0 ? <p>No products added.</p> : <>{cartItems.map((item) => <div key={item.productId} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-light)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{item.productName}</strong><strong>₱{(item.unitPrice * item.quantity).toFixed(2)}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>₱{item.unitPrice.toFixed(2)} × {item.quantity}</span><div><button onClick={() => handleIncreaseCartQuantity(item.productId)}>+</button><button onClick={() => handleDecreaseCartQuantity(item.productId)}>−</button><button onClick={() => setCartItems((items) => items.filter((candidate) => candidate.productId !== item.productId))}>Remove</button></div></div>{cartMessageProductId === item.productId && cartMessage && <p>{cartMessage}</p>}</div>)}<hr/><div style={{ display: 'flex', justifyContent: 'space-between' }}><h2>Total: ₱{cartTotal.toFixed(2)}</h2><button onClick={handleClearCart}>Clear cart</button></div><h3>Payment</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}><button onClick={() => { setPaymentMethod('CASH'); setCashReceived('') }}>Cash</button><button onClick={() => { setPaymentMethod('GCASH'); setCashReceived('') }}>GCash</button></div>{paymentMethod === 'CASH' ? <><label>Cash Received<input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}><button onClick={() => setCashReceived(cartTotal.toFixed(2))}>Exact</button>{[5,10,20,50,100,500].map((amount) => <button key={amount} onClick={() => setCashReceived(((Number(cashReceived) || 0) + amount).toFixed(2))}>+₱{amount}</button>)}<button onClick={() => setCashReceived('')}>Clear</button></div>{cashReceived && (cashReceivedAmount >= cartTotal ? <h3>Change: ₱{changeDue.toFixed(2)}</h3> : <p>Remaining: ₱{remainingAmount.toFixed(2)}</p>)}</> : <p>GCash payment: ₱{cartTotal.toFixed(2)}</p>}<button onClick={() => void handleCompleteSale()} disabled={!canCompleteSale}>Complete Sale</button>{saleMessage && <p>{saleMessage}</p>}</>}</section>
    </main>
  }

  return <><nav className="app-nav"><button className={currentPage === 'pos' ? 'nav-button active' : 'nav-button'} onClick={() => setCurrentPage('pos')}>POS</button><button className={currentPage === 'procurement' ? 'nav-button active' : 'nav-button'} onClick={() => setCurrentPage('procurement')}>Procurement</button><button className={currentPage === 'ledgers' ? 'nav-button active' : 'nav-button'} onClick={() => setCurrentPage('ledgers')}>Ledgers</button></nav>{renderCurrentPage()}<UpdatePrompt appVersion={APP_VERSION} /></>
}

export default App
