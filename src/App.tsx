import { useEffect, useState } from 'react'
import {
  db,
  type Category,
  type Product,
  type Supplier,
} from './db/database'
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

type ProcurementStage =
  | 'idle'
  | 'details'

interface CartItem {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

type PaymentMethod = 'CASH' | 'GCASH'

const APP_VERSION = import.meta.env.VITE_APP_VERSION

const CATEGORY_DISPLAY_ORDER = [
  'Snacks',
  'Beverages',
  'Milk and Coffee',
  'Cooking Essentials',
  'Canned Goods',
  'Instant Noodles',
  'Household Cleaning',
  'Personal Care',
  'Cigarettes',
  'Miscellaneous',
]

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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

  const [procurementStage, setProcurementStage] =
    useState<ProcurementStage>('idle')

  const [procurementSupplierId, setProcurementSupplierId] =
    useState('')
  const [procurementDate, setProcurementDate] = useState('')
  const [procurementItems, setProcurementItems] = useState<
    ProcurementItemInput[]
  >([])
  const [
    procurementProductSearch,
    setProcurementProductSearch,
  ] = useState('')
  const [
    activeProcurementProductId,
    setActiveProcurementProductId,
  ] = useState<string | null>(null)
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemTotalCost, setItemTotalCost] = useState('')
  const [itemSellingPrice, setItemSellingPrice] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')
  const [
    focusedProcurementCategoryId,
    setFocusedProcurementCategoryId,
  ] = useState<string | null>(null)

  const [priceProductId, setPriceProductId] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [priceMessage, setPriceMessage] = useState('')
  const [latestPriceReference, setLatestPriceReference] =
    useState<LatestValidProcurementForProduct | null>(null)

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartMessage, setCartMessage] = useState('')
  const [cartMessageProductId, setCartMessageProductId] =
    useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [saleMessage, setSaleMessage] = useState('')
  const [focusedPosCategoryId, setFocusedPosCategoryId] =
    useState<string | null>(null)

  const orderedCategories = [...categories].sort((a, b) => {
    const aIndex = CATEGORY_DISPLAY_ORDER.indexOf(a.name)
    const bIndex = CATEGORY_DISPLAY_ORDER.indexOf(b.name)

    if (aIndex === -1 && bIndex === -1) {
      return a.name.localeCompare(b.name)
    }

    if (aIndex === -1) {
      return 1
    }

    if (bIndex === -1) {
      return -1
    }

    return aIndex - bIndex
  })

  const orderedSuppliers = [...suppliers].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', {
      sensitivity: 'base',
    }),
  )

  const activeProducts = products.filter(
    (product) => product.active,
  )

  const categorizedProducts = orderedCategories
    .filter((category) => category.active)
    .map((category) => ({
      category,
      products: activeProducts
        .filter(
          (product) =>
            product.categoryId === category.id,
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'en', {
            sensitivity: 'base',
          }),
        ),
    }))
    .filter(
      (categoryGroup) =>
        categoryGroup.products.length > 0,
    )

  const uncategorizedProducts = activeProducts
    .filter((product) => {
      if (!product.categoryId) {
        return true
      }

      return !categories.some(
        (category) =>
          category.id === product.categoryId,
      )
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, 'en', {
        sensitivity: 'base',
      }),
    )

  const normalizedProcurementProductSearch =
    procurementProductSearch.trim().toLocaleLowerCase()

  const procurementProductGroups = orderedCategories
    .filter((category) => category.active)
    .map((category) => ({
      category,
      products: activeProducts
        .filter(
          (product) =>
            product.categoryId === category.id &&
            (
              !normalizedProcurementProductSearch ||
              product.name
                .toLocaleLowerCase()
                .includes(normalizedProcurementProductSearch)
            ),
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'en', {
            sensitivity: 'base',
          }),
        ),
    }))
    .filter((group) => group.products.length > 0)

  const procurementUncategorizedProducts = activeProducts
    .filter((product) => {
      const categoryExists = product.categoryId
        ? categories.some(
            (category) => category.id === product.categoryId,
          )
        : false

      const matchesSearch =
        !normalizedProcurementProductSearch ||
        product.name
          .toLocaleLowerCase()
          .includes(normalizedProcurementProductSearch)

      return !categoryExists && matchesSearch
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, 'en', {
        sensitivity: 'base',
      }),
    )

  const cartTotal = cartItems.reduce(
    (total, item) =>
      total + item.unitPrice * item.quantity,
    0,
  )

  const cashReceivedAmount = Number(cashReceived)

  const changeDue =
    paymentMethod === 'CASH' &&
    Number.isFinite(cashReceivedAmount) &&
    cashReceivedAmount >= cartTotal
      ? cashReceivedAmount - cartTotal
      : 0

  const remainingAmount =
    paymentMethod === 'CASH' &&
    Number.isFinite(cashReceivedAmount) &&
    cashReceivedAmount > 0 &&
    cashReceivedAmount < cartTotal
      ? cartTotal - cashReceivedAmount
      : 0

  const canCompleteSale =
    cartItems.length > 0 &&
    (
      paymentMethod === 'GCASH' ||
      (
        Number.isFinite(cashReceivedAmount) &&
        cashReceivedAmount >= cartTotal
      )
    )

  const procurementTotal = procurementItems.reduce(
    (total, item) => total + item.totalCost,
    0,
  )

  const procurementTotalQuantity = procurementItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  function getDisplayedStock(product: Product) {
    const cartItem = cartItems.find(
      (item) => item.productId === product.id,
    )

    return Math.max(
      0,
      product.currentStockCache - (cartItem?.quantity ?? 0),
    )
  }

  function handlePosCategoryJump(categoryId: string) {
    const categorySection = document.getElementById(
      `pos-category-${categoryId}`,
    )
    const categoryNavigation = document.getElementById(
      'pos-category-navigation',
    )
    const productsPanel = document.querySelector('.products-panel')

    if (
      !categorySection ||
      !categoryNavigation ||
      !(productsPanel instanceof HTMLElement)
    ) {
      return
    }

    const categoryNavigationHeight =
      categoryNavigation.getBoundingClientRect().height

    const targetTop =
      productsPanel.scrollTop +
      categorySection.getBoundingClientRect().top -
      productsPanel.getBoundingClientRect().top -
      categoryNavigationHeight -
      10

    setFocusedPosCategoryId(categoryId)

    productsPanel.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'instant',
    })
  }

  function handleProcurementCategoryJump(categoryId: string) {
    const categorySection = document.getElementById(
      `procurement-category-${categoryId}`,
    )
    const selectionPanel = document.querySelector(
      '.procurement-selection-panel',
    )
    const selectionToolbar = document.querySelector(
      '.procurement-selection-toolbar',
    )

    if (
      !categorySection ||
      !(selectionPanel instanceof HTMLElement) ||
      !(selectionToolbar instanceof HTMLElement)
    ) {
      return
    }

    const toolbarHeight =
      selectionToolbar.getBoundingClientRect().height

    const targetTop =
      selectionPanel.scrollTop +
      categorySection.getBoundingClientRect().top -
      selectionPanel.getBoundingClientRect().top -
      toolbarHeight -
      10

    setFocusedProcurementCategoryId(categoryId)

    selectionPanel.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'instant',
    })
  }

  const priceProduct =
    products.find((product) => product.id === priceProductId) ?? null

  const latestPriceSupplier =
    latestPriceReference?.procurement.supplierId
      ? suppliers.find(
          (supplier) =>
            supplier.id ===
            latestPriceReference.procurement.supplierId,
        ) ?? null
      : null

  useEffect(() => {
    async function loadData() {
      await initializeDefaultCategories()

      const savedProducts = await db.products.toArray()
      setProducts(savedProducts)

      const savedCategories = await db.categories.toArray()
      setCategories(savedCategories)

      const savedSuppliers = await db.suppliers.toArray()
      setSuppliers(savedSuppliers)
    }

    loadData()
  }, [])

  useEffect(() => {
    async function refreshPriceReference() {
      if (currentPage !== 'procurement' || !priceProductId) {
        return
      }

      const latestReference =
        await getLatestValidProcurementForProduct(priceProductId)

      setLatestPriceReference(latestReference ?? null)
    }

    refreshPriceReference()
  }, [currentPage, priceProductId])

  useEffect(() => {
    if (currentPage !== 'pos' || !focusedPosCategoryId) {
      return
    }

    function clearFocusedCategory() {
      setFocusedPosCategoryId(null)
    }

    window.addEventListener('wheel', clearFocusedCategory, {
      passive: true,
    })
    window.addEventListener('touchmove', clearFocusedCategory, {
      passive: true,
    })

    return () => {
      window.removeEventListener('wheel', clearFocusedCategory)
      window.removeEventListener('touchmove', clearFocusedCategory)
    }
  }, [currentPage, focusedPosCategoryId])

  useEffect(() => {
    if (
      currentPage !== 'procurement' ||
      !focusedProcurementCategoryId
    ) {
      return
    }

    const selectionPanel = document.querySelector(
      '.procurement-selection-panel',
    )

    if (!(selectionPanel instanceof HTMLElement)) {
      return
    }

    function clearFocusedCategory() {
      setFocusedProcurementCategoryId(null)
    }

    selectionPanel.addEventListener(
      'wheel',
      clearFocusedCategory,
      {
        passive: true,
      },
    )

    selectionPanel.addEventListener(
      'touchmove',
      clearFocusedCategory,
      {
        passive: true,
      },
    )

    return () => {
      selectionPanel.removeEventListener(
        'wheel',
        clearFocusedCategory,
      )
      selectionPanel.removeEventListener(
        'touchmove',
        clearFocusedCategory,
      )
    }
  }, [currentPage, focusedProcurementCategoryId])

  async function refreshProducts() {
    const savedProducts = await db.products.toArray()
    setProducts(savedProducts)
  }

  async function refreshSuppliers() {
    const savedSuppliers = await db.suppliers.toArray()
    setSuppliers(savedSuppliers)
  }

  function setProductCartMessage(
    productId: string | null,
    message: string,
  ) {
    setCartMessageProductId(productId)
    setCartMessage(message)
  }

  function handleAddProductToCart(product: Product) {
    setProductCartMessage(null, '')

    if (product.sellingPrice <= 0) {
      setProductCartMessage(
        product.id,
        `${product.name} does not have a selling price yet.`,
      )
      return
    }

    if (getDisplayedStock(product) <= 0) {
      setProductCartMessage(
        product.id,
        `${product.name} is out of stock.`,
      )
      return
    }

    const existingItem = cartItems.find(
      (item) => item.productId === product.id,
    )

    if (existingItem) {
      setCartItems((currentItems) =>
        currentItems.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        ),
      )

      return
    }

    setCartItems((currentItems) => [
      ...currentItems,
      {
        productId: product.id,
        productName: product.name,
        unitPrice: product.sellingPrice,
        quantity: 1,
      },
    ])
  }

  function handleIncreaseCartQuantity(productId: string) {
    setProductCartMessage(null, '')

    const product = products.find(
      (candidate) => candidate.id === productId,
    )

    if (!product) {
      setProductCartMessage(
        null,
        'Product was not found.',
      )
      return
    }

    if (getDisplayedStock(product) <= 0) {
      setProductCartMessage(
        product.id,
        `${product.name} is out of stock.`,
      )
      return
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item,
      ),
    )
  }

  function handleDecreaseCartQuantity(productId: string) {
    setProductCartMessage(null, '')

    setCartItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.productId !== productId) {
          return [item]
        }

        if (item.quantity <= 1) {
          return []
        }

        return [
          {
            ...item,
            quantity: item.quantity - 1,
          },
        ]
      }),
    )
  }

  function handleRemoveCartItem(productId: string) {
    setProductCartMessage(null, '')

    setCartItems((currentItems) =>
      currentItems.filter(
        (item) => item.productId !== productId,
      ),
    )
  }

  function handleClearCart() {
    setCartItems([])
    setProductCartMessage(null, '')
    setPaymentMethod('CASH')
    setCashReceived('')
    setSaleMessage('')
  }

  function handlePaymentMethodChange(method: PaymentMethod) {
    setPaymentMethod(method)
    setCashReceived('')
    setSaleMessage('')
  }

  function handleQuickCashAmount(amount: number) {
    const currentAmount = Number(cashReceived)
    const safeCurrentAmount = Number.isFinite(currentAmount)
      ? currentAmount
      : 0

    setCashReceived(
      (safeCurrentAmount + amount).toFixed(2),
    )
  }

  function handleExactCashAmount() {
    setCashReceived(cartTotal.toFixed(2))
  }

  function handleClearCashAmount() {
    setCashReceived('')
    setSaleMessage('')
  }

  async function handleCompleteSale() {
    if (!canCompleteSale) {
      return
    }

    try {
      setSaleMessage('')

      await createSale({
        paymentMethod,
        cashReceived:
          paymentMethod === 'CASH'
            ? cashReceivedAmount
            : undefined,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      })

      await refreshProducts()

      setCartItems([])
      setProductCartMessage(null, '')
      setPaymentMethod('CASH')
      setCashReceived('')
      setSaleMessage('Sale completed.')
    } catch (error) {
      if (error instanceof Error) {
        setSaleMessage(error.message)
        return
      }

      setSaleMessage('Unable to complete sale.')
    }
  }

  function resetProcurementDraft() {
    setProcurementStage('idle')
    setProcurementSupplierId('')
    setProcurementDate('')
    setProcurementItems([])
    setProcurementProductSearch('')
    setActiveProcurementProductId(null)
    setItemQuantity('')
    setItemTotalCost('')
    setItemSellingPrice('')
    setFocusedProcurementCategoryId(null)
  }

  function handleStartNewProcurement() {
    setProcurementMessage('')
    setProcurementSupplierId('')
    setProcurementDate(getTodayDate())
    setProcurementItems([])
    setProcurementProductSearch('')
    setActiveProcurementProductId(null)
    setItemQuantity('')
    setItemTotalCost('')
    setItemSellingPrice('')
    setFocusedProcurementCategoryId(null)
    setProcurementStage('details')
  }

  function handleSelectProcurementProduct(productId: string) {
    const product = products.find(
      (candidate) => candidate.id === productId,
    )

    if (!product) {
      setProcurementMessage('Product was not found.')
      return
    }

    const existingItem = procurementItems.find(
      (item) => item.productId === productId,
    )

    setActiveProcurementProductId(productId)

    setItemQuantity(
      existingItem ? String(existingItem.quantity) : '',
    )

    setItemTotalCost(
      existingItem ? String(existingItem.totalCost) : '',
    )

    const existingPrice = existingItem?.appliedSellingPrice

    setItemSellingPrice(
      existingPrice !== undefined
        ? String(existingPrice)
        : product.sellingPrice > 0
          ? String(product.sellingPrice)
          : '',
    )

    setProcurementMessage('')
  }

  function handleCancelProcurementProductEntry() {
    setActiveProcurementProductId(null)
    setItemQuantity('')
    setItemTotalCost('')
    setItemSellingPrice('')
    setProcurementMessage('')
  }

  function handleAddProcurementItem() {
    if (!activeProcurementProductId) {
      setProcurementMessage('Select a product first.')
      return
    }

    const product = products.find(
      (candidate) =>
        candidate.id === activeProcurementProductId,
    )

    if (!product) {
      setProcurementMessage('Product was not found.')
      return
    }

    const quantity = Number(itemQuantity)
    const totalCost = Number(itemTotalCost)
    const sellingPrice = Number(itemSellingPrice)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setProcurementMessage(
        `${product.name}: quantity must be greater than zero.`,
      )
      return
    }

    if (!Number.isInteger(quantity)) {
      setProcurementMessage(
        `${product.name}: quantity must be a whole number.`,
      )
      return
    }

    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      setProcurementMessage(
        `${product.name}: total cost must be greater than zero.`,
      )
      return
    }

    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      setProcurementMessage(
        `${product.name}: selling price must be greater than zero.`,
      )
      return
    }

    const nextItem: ProcurementItemInput = {
      productId: product.id,
      quantity,
      totalCost,
      appliedSellingPrice: sellingPrice,
    }

    setProcurementItems((currentItems) => {
      if (
        currentItems.some(
          (item) => item.productId === product.id,
        )
      ) {
        return currentItems.map((item) =>
          item.productId === product.id
            ? nextItem
            : item,
        )
      }

      return [...currentItems, nextItem]
    })

    setActiveProcurementProductId(null)
    setItemQuantity('')
    setItemTotalCost('')
    setItemSellingPrice('')
    setProcurementMessage('')
  }

  function handleRemoveProcurementItem(productId: string) {
    setProcurementItems((currentItems) =>
      currentItems.filter(
        (item) => item.productId !== productId,
      ),
    )

    if (activeProcurementProductId === productId) {
      setActiveProcurementProductId(null)
      setItemQuantity('')
      setItemTotalCost('')
      setItemSellingPrice('')
    }

    setProcurementMessage('')
  }

  async function handleSaveProcurement() {
    try {
      if (!procurementDate) {
        setProcurementMessage('Procurement date is required.')
        return
      }

      if (!procurementSupplierId) {
        setProcurementMessage('Supplier is required.')
        return
      }

      if (activeProcurementProductId) {
        setProcurementMessage(
          'Finish or cancel the active product entry before saving.',
        )
        return
      }

      if (procurementItems.length === 0) {
        setProcurementMessage(
          'Add at least one product before saving the procurement.',
        )
        return
      }

      const invalidPriceItem = procurementItems.find(
        (item) =>
          item.appliedSellingPrice === undefined ||
          item.appliedSellingPrice <= 0,
      )

      if (invalidPriceItem) {
        const product = products.find(
          (candidate) =>
            candidate.id === invalidPriceItem.productId,
        )

        setProcurementMessage(
          `${product?.name ?? 'Product'} needs a selling price greater than zero before this procurement can be saved.`,
        )
        return
      }

      const input = {
        supplierId: procurementSupplierId,
        procurementDate,
        items: procurementItems,
      }

      const duplicate =
        await findPotentialDuplicateProcurement(input)

      if (duplicate) {
        const duplicateSupplier =
          suppliers.find(
            (supplier) =>
              supplier.id === duplicate.supplierId,
          )?.name ?? 'Unknown supplier'

        const shouldSave = window.confirm(
          `A similar procurement has already been recorded.\n\n` +
            `Procurement date: ${duplicate.procurementDate}\n` +
            `Supplier: ${duplicateSupplier}\n` +
            `Items: ${procurementItems.length}\n` +
            `Total procurement cost: ₱${procurementTotal.toFixed(
              2,
            )}\n\n` +
            `Save this as another valid procurement?`,
        )

        if (!shouldSave) {
          setProcurementMessage('Procurement cancelled.')
          return
        }
      }

      await createProcurement(input)
      await refreshProducts()

      resetProcurementDraft()

      setProcurementMessage('Procurement saved.')
    } catch (error) {
      if (error instanceof Error) {
        setProcurementMessage(error.message)
        return
      }

      setProcurementMessage('Unable to save procurement.')
    }
  }

  async function handleCreateProduct() {
    try {
      await createProduct(
        productName,
        productCategoryId,
      )

      await refreshProducts()

      setProductName('')
      setProductMessage('Product created.')
    } catch (error) {
      if (error instanceof Error) {
        setProductMessage(error.message)
        return
      }

      setProductMessage('Unable to create product.')
    }
  }

  async function handleCreateSupplier() {
    try {
      await createSupplier(supplierName)
      await refreshSuppliers()

      setSupplierName('')
      setSupplierMessage('Supplier created.')
    } catch (error) {
      if (error instanceof Error) {
        setSupplierMessage(error.message)
        return
      }

      setSupplierMessage('Unable to create supplier.')
    }
  }

  async function handlePriceProductChange(productId: string) {
    setPriceProductId(productId)
    setNewSellingPrice('')
    setPriceMessage('')
    setLatestPriceReference(null)

    if (!productId) {
      return
    }

    const latestReference =
      await getLatestValidProcurementForProduct(productId)

    setLatestPriceReference(latestReference ?? null)
  }

  async function handleSetProductPrice() {
    try {
      await setProductPrice({
        productId: priceProductId,
        newPrice: Number(newSellingPrice),
        procurementId:
          latestPriceReference?.procurement.id,
        reason: 'Manual price update',
      })

      await refreshProducts()

      setNewSellingPrice('')
      setPriceMessage('Selling price updated.')
    } catch (error) {
      if (error instanceof Error) {
        setPriceMessage(error.message)
        return
      }

      setPriceMessage('Unable to update selling price.')
    }
  }

  function renderProcurementWorkflow() {
    if (procurementStage === 'idle') {
      return (
        <section>
          <h2>Add Procurement</h2>

          <button onClick={handleStartNewProcurement}>
            Add Procurement
          </button>

          {procurementMessage && <p>{procurementMessage}</p>}
        </section>
      )
    }

    const worksheetColumns =
      'minmax(240px, 2.4fr) minmax(90px, 0.7fr) minmax(120px, 1fr) minmax(105px, 0.8fr) minmax(105px, 0.8fr) minmax(135px, 1fr) minmax(130px, 1fr)'

    const renderProcurementProduct = (product: Product) => {
      const addedItem = procurementItems.find(
        (item) => item.productId === product.id,
      )

      const isActive =
        activeProcurementProductId === product.id

      const activeQuantity = Number(itemQuantity)
      const activeTotalCost = Number(itemTotalCost)

      const hasValidActiveCost =
        isActive &&
        Number.isFinite(activeQuantity) &&
        activeQuantity > 0 &&
        Number.isFinite(activeTotalCost) &&
        activeTotalCost > 0

      const activeCalculation = hasValidActiveCost
        ? calculateProcurementValues(
            activeQuantity,
            activeTotalCost,
          )
        : null

      const addedCalculation = addedItem
        ? calculateProcurementValues(
            addedItem.quantity,
            addedItem.totalCost,
          )
        : null

      const rowBackground = isActive
        ? 'var(--color-primary-light)'
        : addedItem
          ? 'var(--color-background-soft)'
          : '#ffffff'

      return (
        <div
          key={product.id}
          style={{
            display: 'grid',
            gridTemplateColumns: worksheetColumns,
            alignItems: 'center',
            gap: '8px',
            minWidth: '1120px',
            minHeight: '58px',
            padding: '7px 10px',
            marginBottom: '6px',
            border: isActive
              ? '1px solid var(--color-primary)'
              : '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-md)',
            background: rowBackground,
            boxShadow: isActive
              ? '0 0 0 2px rgba(41, 68, 95, 0.10)'
              : 'none',
          }}
        >
          <div
            style={{
              minWidth: 0,
              fontWeight: 650,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={product.name}
          >
            {product.name}
          </div>

          {isActive ? (
            <>
              <input
                type="number"
                min="1"
                step="1"
                value={itemQuantity}
                onChange={(event) => {
                  setItemQuantity(event.target.value)
                  setProcurementMessage('')
                }}
                inputMode="numeric"
                aria-label={`${product.name} quantity`}
                placeholder="Qty"
                style={{
                  minWidth: 0,
                  minHeight: '38px',
                  margin: 0,
                  padding: '6px 8px',
                }}
              />

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={itemTotalCost}
                onChange={(event) => {
                  setItemTotalCost(event.target.value)
                  setProcurementMessage('')
                }}
                inputMode="decimal"
                aria-label={`${product.name} total cost`}
                placeholder="0.00"
                style={{
                  minWidth: 0,
                  minHeight: '38px',
                  margin: 0,
                  padding: '6px 8px',
                }}
              />

              <strong
                style={{
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {activeCalculation
                  ? `₱${activeCalculation.unitCost.toFixed(2)}`
                  : '—'}
              </strong>

              <strong
                style={{
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  color: 'var(--color-primary-dark)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {activeCalculation
                  ? `₱${activeCalculation.suggestedSellingPrice.toFixed(
                      2,
                    )}`
                  : '—'}
              </strong>

              <div
                style={{
                  minWidth: 0,
                }}
              >
                {product.sellingPrice > 0 && (
                  <small
                    style={{
                      display: 'block',
                      marginBottom: '2px',
                      fontSize: '0.68rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Current ₱
                    {product.sellingPrice.toFixed(2)}
                  </small>
                )}

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={itemSellingPrice}
                  onChange={(event) => {
                    setItemSellingPrice(event.target.value)
                    setProcurementMessage('')
                  }}
                  inputMode="decimal"
                  aria-label={`${product.name} selling price`}
                  placeholder="0.00"
                  style={{
                    minWidth: 0,
                    minHeight: '38px',
                    margin: 0,
                    padding: '6px 8px',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '5px',
                }}
              >
                <button
                  onClick={handleCancelProcurementProductEntry}
                  style={{
                    minHeight: '36px',
                    margin: 0,
                    padding: '5px 7px',
                    fontSize: '0.75rem',
                  }}
                >
                  Cancel
                </button>

                <button
                  className="procurement-primary-button"
                  onClick={handleAddProcurementItem}
                  style={{
                    minHeight: '36px',
                    margin: 0,
                    padding: '5px 7px',
                    fontSize: '0.75rem',
                  }}
                >
                  {addedItem ? 'Update' : 'Add'}
                </button>
              </div>
            </>
          ) : addedItem && addedCalculation ? (
            <>
              <strong
                style={{
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {addedItem.quantity}
              </strong>

              <strong
                style={{
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₱{addedItem.totalCost.toFixed(2)}
              </strong>

              <strong
                style={{
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₱{addedCalculation.unitCost.toFixed(2)}
              </strong>

              <strong
                style={{
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  color: 'var(--color-primary-dark)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₱
                {addedCalculation.suggestedSellingPrice.toFixed(
                  2,
                )}
              </strong>

              <div
                style={{
                  textAlign: 'right',
                }}
              >
                {product.sellingPrice > 0 && (
                  <small
                    style={{
                      display: 'block',
                      fontSize: '0.68rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Current ₱
                    {product.sellingPrice.toFixed(2)}
                  </small>
                )}

                <strong
                  style={{
                    display: 'block',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ₱
                  {(addedItem.appliedSellingPrice ?? 0).toFixed(
                    2,
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '5px',
                }}
              >
                <button
                  onClick={() =>
                    handleSelectProcurementProduct(product.id)
                  }
                  style={{
                    minHeight: '36px',
                    margin: 0,
                    padding: '5px 7px',
                    fontSize: '0.75rem',
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() =>
                    handleRemoveProcurementItem(product.id)
                  }
                  style={{
                    minHeight: '36px',
                    margin: 0,
                    padding: '5px 7px',
                    fontSize: '0.75rem',
                  }}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <span
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                —
              </span>

              <span
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                —
              </span>

              <span
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                —
              </span>

              <span
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                —
              </span>

              <span
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                {product.sellingPrice > 0
                  ? `Current ₱${product.sellingPrice.toFixed(2)}`
                  : '—'}
              </span>

              <button
                onClick={() =>
                  handleSelectProcurementProduct(product.id)
                }
                style={{
                  minHeight: '36px',
                  margin: 0,
                  padding: '5px 8px',
                  fontSize: '0.78rem',
                }}
              >
                Select
              </button>
            </>
          )}
        </div>
      )
    }

    return (
      <section
        className="procurement-active-workflow"
        style={{
          padding: '12px',
        }}
      >
        <section
          className="procurement-selection-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
          }}
        >
          <div
            className="procurement-selection-toolbar"
            style={{
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(155px, 0.7fr) minmax(230px, 1.2fr) minmax(230px, 1.3fr)',
                alignItems: 'end',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <label
                style={{
                  margin: 0,
                  minWidth: 0,
                }}
              >
                Date
                <input
                  type="date"
                  value={procurementDate}
                  onChange={(event) => {
                    setProcurementDate(event.target.value)
                    setProcurementMessage('')
                  }}
                  style={{
                    marginTop: '4px',
                  }}
                />
              </label>

              <label
                style={{
                  margin: 0,
                  minWidth: 0,
                }}
              >
                Supplier
                <select
                  value={procurementSupplierId}
                  onChange={(event) => {
                    setProcurementSupplierId(
                      event.target.value,
                    )
                    setProcurementMessage('')
                  }}
                  style={{
                    marginTop: '4px',
                  }}
                >
                  <option value="">
                    Select a supplier
                  </option>

                  {orderedSuppliers.map((supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <input
                type="search"
                aria-label="Search products"
                value={procurementProductSearch}
                onChange={(event) => {
                  setProcurementProductSearch(
                    event.target.value,
                  )
                  setFocusedProcurementCategoryId(null)
                }}
                placeholder="Search products..."
                style={{
                  minWidth: 0,
                  margin: 0,
                }}
              />
            </div>

            {(procurementProductGroups.length > 0 ||
              procurementUncategorizedProducts.length > 0) && (
              <div
                className="procurement-category-navigation"
                aria-label="Procurement product categories"
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(5, minmax(0, 1fr))',
                  gap: '7px',
                  marginBottom: '9px',
                }}
              >
                {procurementProductGroups.map(
                  ({ category }) => (
                    <button
                      className={`procurement-category-button ${
                        focusedProcurementCategoryId ===
                        category.id
                          ? 'active'
                          : ''
                      }`}
                      key={category.id}
                      onClick={() =>
                        handleProcurementCategoryJump(
                          category.id,
                        )
                      }
                      title={category.name}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        minHeight: '38px',
                        margin: 0,
                        padding: '6px 8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {category.name}
                    </button>
                  ),
                )}

                {procurementUncategorizedProducts.length >
                  0 && (
                  <button
                    className={`procurement-category-button ${
                      focusedProcurementCategoryId ===
                      'uncategorized'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      handleProcurementCategoryJump(
                        'uncategorized',
                      )
                    }
                    title="Uncategorized"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      minHeight: '38px',
                      margin: 0,
                      padding: '6px 8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Uncategorized
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: worksheetColumns,
                alignItems: 'center',
                gap: '8px',
                minWidth: '1120px',
                padding: '7px 10px',
                background: '#eef0f3',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-sm)',
                color: '#374151',
                fontSize: '0.72rem',
                fontWeight: 750,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              <span>Product</span>
              <span style={{ textAlign: 'right' }}>
                Quantity
              </span>
              <span style={{ textAlign: 'right' }}>
                Total Cost
              </span>
              <span style={{ textAlign: 'right' }}>
                Unit Cost
              </span>
              <span style={{ textAlign: 'right' }}>
                SRP
              </span>
              <span style={{ textAlign: 'right' }}>
                Selling Price
              </span>
              <span style={{ textAlign: 'center' }}>
                Action
              </span>
            </div>
          </div>

          <div
            className="procurement-receipt-product-list"
            style={{
              minWidth: '1148px',
            }}
          >
            {procurementProductGroups.map(
              ({
                category,
                products: categoryProducts,
              }) => (
                <section
                  id={`procurement-category-${category.id}`}
                  className="procurement-receipt-category"
                  key={category.id}
                >
                  <h4>{category.name}</h4>

                  {categoryProducts.map(
                    renderProcurementProduct,
                  )}
                </section>
              ),
            )}

            {procurementUncategorizedProducts.length > 0 && (
              <section
                id="procurement-category-uncategorized"
                className="procurement-receipt-category"
              >
                <h4>Uncategorized</h4>

                {procurementUncategorizedProducts.map(
                  renderProcurementProduct,
                )}
              </section>
            )}

            {procurementProductGroups.length === 0 &&
              procurementUncategorizedProducts.length ===
                0 && (
                <p>No products match your search.</p>
              )}
          </div>
        </section>

        <div
          style={{
            flexShrink: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: '14px',
            marginTop: '10px',
            padding: '10px 12px',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-md)',
            background: '#ffffff',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '18px',
                fontSize: '0.82rem',
              }}
            >
              <span>
                <strong>{procurementItems.length}</strong>{' '}
                Products
              </span>

              <span>
                <strong>{procurementTotalQuantity}</strong>{' '}
                Total Qty
              </span>

              <span>
                <strong>
                  ₱{procurementTotal.toFixed(2)}
                </strong>{' '}
                Total Procurement
              </span>
            </div>

            {procurementMessage && (
              <p
                className="procurement-message"
                style={{
                  margin: '6px 0 0',
                }}
              >
                {procurementMessage}
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => {
                resetProcurementDraft()
                setProcurementMessage('')
              }}
              style={{
                margin: 0,
              }}
            >
              Cancel Procurement
            </button>

            <button
              className="procurement-primary-button"
              onClick={handleSaveProcurement}
              style={{
                margin: 0,
              }}
            >
              Save Procurement
            </button>
          </div>
        </div>
      </section>
    )
  }

  function renderCurrentPage() {
    if (currentPage === 'procurement') {
      return (
        <main
          className={
            procurementStage === 'details'
              ? 'procurement-page-active'
              : undefined
          }
        >
          {procurementStage === 'idle' && (
            <h1>Procurement</h1>
          )}

          {renderProcurementWorkflow()}

          {procurementStage === 'idle' && (
            <>
              <section>
                <h2>Add Product</h2>

                <label>
                  Product Name
                  <input
                    type="text"
                    value={productName}
                    onChange={(event) =>
                      setProductName(event.target.value)
                    }
                  />
                </label>

                <fieldset className="category-selector">
                  <legend>Category</legend>

                  <div className="category-options">
                    {orderedCategories
                      .filter((category) => category.active)
                      .map((category) => (
                        <label
                          key={category.id}
                          className={`category-option ${
                            productCategoryId === category.id
                              ? 'selected'
                              : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="product-category"
                            value={category.id}
                            checked={
                              productCategoryId === category.id
                            }
                            onChange={(event) =>
                              setProductCategoryId(
                                event.target.value,
                              )
                            }
                          />

                          <span>{category.name}</span>
                        </label>
                      ))}
                  </div>
                </fieldset>

                <button onClick={handleCreateProduct}>
                  Add Product
                </button>

                {productMessage && <p>{productMessage}</p>}
              </section>

              <section>
                <h2>Add Supplier</h2>

                <label>
                  Supplier Name
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(event) =>
                      setSupplierName(event.target.value)
                    }
                  />
                </label>

                <button onClick={handleCreateSupplier}>
                  Add Supplier
                </button>

                {supplierMessage && <p>{supplierMessage}</p>}
              </section>

              <section>
                <h2>Set Price</h2>

                <label>
                  Product
                  <select
                    value={priceProductId}
                    onChange={(event) =>
                      handlePriceProductChange(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Select a product
                    </option>

                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                {priceProduct && (
                  <>
                    <p>
                      Current Selling Price:{' '}
                      {priceProduct.sellingPrice > 0
                        ? `₱${priceProduct.sellingPrice.toFixed(
                            2,
                          )}`
                        : 'Not set'}
                    </p>

                    {latestPriceReference ? (
                      <>
                        <h3>Latest Procurement</h3>

                        <p>
                          Date:{' '}
                          {
                            latestPriceReference.procurement
                              .procurementDate
                          }
                        </p>

                        <p>
                          Supplier:{' '}
                          {latestPriceSupplier?.name ??
                            'Unknown supplier'}
                        </p>

                        <p>
                          Unit Cost: ₱
                          {latestPriceReference.item.unitCost.toFixed(
                            2,
                          )}
                        </p>

                        <p>
                          Suggested SRP: ₱
                          {latestPriceReference.item.suggestedSellingPrice.toFixed(
                            2,
                          )}
                        </p>
                      </>
                    ) : (
                      <p>
                        No valid procurement history found.
                      </p>
                    )}
                  </>
                )}

                <label>
                  New Selling Price
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={newSellingPrice}
                    onChange={(event) =>
                      setNewSellingPrice(
                        event.target.value,
                      )
                    }
                  />
                </label>

                {newSellingPrice !== '' &&
                  Number(newSellingPrice) <= 0 && (
                    <p>
                      Selling price must be greater than zero.
                    </p>
                  )}

                <button onClick={handleSetProductPrice}>
                  Set Price
                </button>

                {priceMessage && <p>{priceMessage}</p>}
              </section>
            </>
          )}
        </main>
      )
    }

    if (currentPage === 'ledgers') {
      return (
        <main>
          <DataViewer
            onProductsChanged={refreshProducts}
            onSuppliersChanged={refreshSuppliers}
          />
        </main>
      )
    }

    return (
      <main className="pos-layout">
        <section className="products-panel">
          <div
            id="pos-category-navigation"
            aria-label="Product categories"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '8px',
              margin: 0,
              padding: '10px 20px',
              background: 'rgba(249, 250, 251, 0.98)',
              borderBottom: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {categorizedProducts.map(({ category }) => (
              <button
                key={category.id}
                onClick={() => handlePosCategoryJump(category.id)}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  margin: 0,
                  padding: '8px 10px',
                  border:
                    focusedPosCategoryId === category.id
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    focusedPosCategoryId === category.id
                      ? 'var(--color-primary)'
                      : 'var(--color-surface)',
                  color:
                    focusedPosCategoryId === category.id
                      ? '#ffffff'
                      : 'var(--color-text)',
                  fontWeight: 700,
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {category.name}
              </button>
            ))}

            {uncategorizedProducts.length > 0 && (
              <button
                onClick={() =>
                  handlePosCategoryJump('uncategorized')
                }
                style={{
                  width: '100%',
                  minHeight: '42px',
                  margin: 0,
                  padding: '8px 10px',
                  border:
                    focusedPosCategoryId === 'uncategorized'
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    focusedPosCategoryId === 'uncategorized'
                      ? 'var(--color-primary)'
                      : 'var(--color-surface)',
                  color:
                    focusedPosCategoryId === 'uncategorized'
                      ? '#ffffff'
                      : 'var(--color-text)',
                  fontWeight: 700,
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                Uncategorized
              </button>
            )}
          </div>

          <div className="products-content">
            {categorizedProducts.map(
              ({
                category,
                products: categoryProducts,
              }) => (
                <section
                  id={`pos-category-${category.id}`}
                  key={category.id}
                >
                  <h2>{category.name}</h2>

                  {categoryProducts.map((product) => (
                    <button
                      className="product-button"
                      key={product.id}
                      onClick={() =>
                        handleAddProductToCart(product)
                      }
                    >
                      {product.name}

                      <span>
                        {product.sellingPrice > 0
                          ? `₱${product.sellingPrice.toFixed(
                              2,
                            )}`
                          : 'Price not set'}
                      </span>

                      <span>
                        Stock: {getDisplayedStock(product)}
                      </span>
                    </button>
                  ))}
                </section>
              ),
            )}

            {uncategorizedProducts.length > 0 && (
              <section id="pos-category-uncategorized">
                <h2>Uncategorized</h2>

                {uncategorizedProducts.map((product) => (
                  <button
                    className="product-button"
                    key={product.id}
                    onClick={() =>
                      handleAddProductToCart(product)
                    }
                  >
                    {product.name}

                    <span>
                      {product.sellingPrice > 0
                        ? `₱${product.sellingPrice.toFixed(
                            2,
                          )}`
                        : 'Price not set'}
                    </span>

                    <span>
                      Stock: {getDisplayedStock(product)}
                    </span>
                  </button>
                ))}
              </section>
            )}
          </div>
        </section>

        <section
          className="cart-panel"
          onPointerDown={() =>
            setFocusedPosCategoryId(null)
          }
        >
          <h1>Cart</h1>

          {cartItems.length === 0 ? (
            <p>No products added.</p>
          ) : (
            <>
              {cartItems.map((item) => (
                <div
                  key={item.productId}
                  style={{
                    padding: '12px 0',
                    borderBottom:
                      '1px solid var(--color-border-light)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(0, 1fr) auto',
                      alignItems: 'center',
                      columnGap: '12px',
                      marginBottom: '8px',
                    }}
                  >
                    <strong
                      style={{
                        minWidth: 0,
                        textAlign: 'left',
                      }}
                    >
                      {item.productName}
                    </strong>

                    <span
                      style={{
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                      }}
                    >
                      ₱
                      {(
                        item.unitPrice * item.quantity
                      ).toFixed(2)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(0, 1fr) auto',
                      alignItems: 'center',
                      columnGap: '12px',
                    }}
                  >
                    <span
                      style={{
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ₱{item.unitPrice.toFixed(2)} ×{' '}
                      {item.quantity}
                    </span>

                    <div
                      style={{
                        display: 'inline-flex',
                        justifyContent: 'flex-end',
                        alignItems: 'stretch',
                      }}
                    >
                      <button
                        onClick={() =>
                          handleIncreaseCartQuantity(
                            item.productId,
                          )
                        }
                        aria-label={`Increase ${item.productName} quantity`}
                        style={{
                          minHeight: '36px',
                          margin: 0,
                          padding: '6px 11px',
                          borderRadius: '6px 0 0 6px',
                        }}
                      >
                        +
                      </button>

                      <button
                        onClick={() =>
                          handleDecreaseCartQuantity(
                            item.productId,
                          )
                        }
                        aria-label={`Decrease ${item.productName} quantity`}
                        style={{
                          minHeight: '36px',
                          margin: 0,
                          marginLeft: '-1px',
                          padding: '6px 11px',
                          borderRadius: 0,
                        }}
                      >
                        −
                      </button>

                      <button
                        onClick={() =>
                          handleRemoveCartItem(
                            item.productId,
                          )
                        }
                        style={{
                          minHeight: '36px',
                          margin: 0,
                          marginLeft: '-1px',
                          padding: '6px 11px',
                          borderRadius:
                            '0 6px 6px 0',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {cartMessage &&
                    cartMessageProductId ===
                      item.productId && (
                      <p
                        style={{
                          margin: '8px 0 0',
                          color: 'var(--color-danger)',
                          fontWeight: 600,
                        }}
                      >
                        {cartMessage}
                      </p>
                    )}
                </div>
              ))}

              <hr />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <h2 style={{ margin: 0 }}>
                  Total: ₱{cartTotal.toFixed(2)}
                </h2>

                <button
                  onClick={handleClearCart}
                  style={{
                    margin: 0,
                    minHeight: '38px',
                    padding: '6px 12px',
                  }}
                >
                  Clear cart
                </button>
              </div>

              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop:
                    '1px solid var(--color-border-light)',
                }}
              >
                <h3>Payment</h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <button
                    onClick={() =>
                      handlePaymentMethodChange('CASH')
                    }
                    style={{
                      margin: 0,
                      background:
                        paymentMethod === 'CASH'
                          ? 'var(--color-primary)'
                          : '#ffffff',
                      color:
                        paymentMethod === 'CASH'
                          ? '#ffffff'
                          : 'var(--color-text)',
                      borderColor:
                        paymentMethod === 'CASH'
                          ? 'var(--color-primary)'
                          : 'var(--color-border)',
                    }}
                  >
                    Cash
                  </button>

                  <button
                    onClick={() =>
                      handlePaymentMethodChange('GCASH')
                    }
                    style={{
                      margin: 0,
                      background:
                        paymentMethod === 'GCASH'
                          ? 'var(--color-primary)'
                          : '#ffffff',
                      color:
                        paymentMethod === 'GCASH'
                          ? '#ffffff'
                          : 'var(--color-text)',
                      borderColor:
                        paymentMethod === 'GCASH'
                          ? 'var(--color-primary)'
                          : 'var(--color-border)',
                    }}
                  >
                    GCash
                  </button>
                </div>

                {paymentMethod === 'CASH' ? (
                  <>
                    <label>
                      Cash Received
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashReceived}
                        onChange={(event) => {
                          setCashReceived(event.target.value)
                          setSaleMessage('')
                        }}
                        placeholder="0.00"
                      />
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(3, 1fr)',
                        gap: '8px',
                        marginTop: '-4px',
                        marginBottom: '16px',
                      }}
                    >
                      <button
                        onClick={handleExactCashAmount}
                        style={{
                          gridColumn: '1 / -1',
                          margin: 0,
                        }}
                      >
                        Exact
                      </button>

                      <button
                        onClick={() =>
                          handleQuickCashAmount(5)
                        }
                        style={{ margin: 0 }}
                      >
                        +₱5
                      </button>

                      <button
                        onClick={() =>
                          handleQuickCashAmount(10)
                        }
                        style={{ margin: 0 }}
                      >
                        +₱10
                      </button>

                      <button
                        onClick={() =>
                          handleQuickCashAmount(20)
                        }
                        style={{ margin: 0 }}
                      >
                        +₱20
                      </button>

                      <button
                        onClick={() =>
                          handleQuickCashAmount(50)
                        }
                        style={{ margin: 0 }}
                      >
                        +₱50
                      </button>

                      <button
                        onClick={() =>
                          handleQuickCashAmount(100)
                        }
                        style={{ margin: 0 }}
                      >
                        +₱100
                      </button>

                      <button
                        onClick={() =>
                          handleQuickCashAmount(500)
                        }
                        style={{ margin: 0 }}
                      >
                        +₱500
                      </button>

                      <button
                        onClick={handleClearCashAmount}
                        style={{
                          gridColumn: '1 / -1',
                          margin: 0,
                        }}
                      >
                        Clear
                      </button>
                    </div>

                    {cashReceived !== '' &&
                      Number.isFinite(
                        cashReceivedAmount,
                      ) &&
                      cashReceivedAmount > 0 && (
                        <>
                          {cashReceivedAmount >=
                          cartTotal ? (
                            <h3>
                              Change: ₱
                              {changeDue.toFixed(2)}
                            </h3>
                          ) : (
                            <p>
                              Remaining: ₱
                              {remainingAmount.toFixed(
                                2,
                              )}
                            </p>
                          )}
                        </>
                      )}
                  </>
                ) : (
                  <p>
                    GCash payment: ₱
                    {cartTotal.toFixed(2)}
                  </p>
                )}

                <button
                  onClick={handleCompleteSale}
                  disabled={!canCompleteSale}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                  }}
                >
                  Complete Sale
                </button>

                {saleMessage && (
                  <p
                    style={{
                      marginTop: '10px',
                      color:
                        saleMessage ===
                        'Sale completed.'
                          ? 'var(--color-success)'
                          : 'var(--color-danger)',
                      fontWeight: 600,
                    }}
                  >
                    {saleMessage}
                  </p>
                )}
              </div>
            </>
          )}

          {cartMessage &&
            cartMessageProductId === null && (
              <p>{cartMessage}</p>
            )}
        </section>
      </main>
    )
  }

  return (
    <>
      <nav className="app-nav">
        <button
          className={
            currentPage === 'pos'
              ? 'nav-button active'
              : 'nav-button'
          }
          onClick={() => setCurrentPage('pos')}
        >
          POS
        </button>

        <button
          className={
            currentPage === 'procurement'
              ? 'nav-button active'
              : 'nav-button'
          }
          onClick={() =>
            setCurrentPage('procurement')
          }
        >
          Procurement
        </button>

        <button
          className={
            currentPage === 'ledgers'
              ? 'nav-button active'
              : 'nav-button'
          }
          onClick={() =>
            setCurrentPage('ledgers')
          }
        >
          Ledgers
        </button>
      </nav>

      {renderCurrentPage()}

      <UpdatePrompt appVersion={APP_VERSION} />
    </>
  )
}

export default App