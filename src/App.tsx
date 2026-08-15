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
import { createSupplier } from './services/supplierService'

type AppPage = 'pos' | 'procurement' | 'ledgers'

type ProcurementStage =
  | 'idle'
  | 'details'
  | 'items'
  | 'review'

const APP_VERSION = '2026.08.15.1'

const CATEGORY_DISPLAY_ORDER = [
  'Beverages',
  'Snacks',
  'Canned Goods',
  'Instant Noodles',
  'Cooking Essentials',
  'Milk and Coffee',
  'Personal Care',
  'Household Cleaning',
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

  const [itemProductId, setItemProductId] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemTotalCost, setItemTotalCost] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')

  const [priceProductId, setPriceProductId] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [priceMessage, setPriceMessage] = useState('')
  const [latestPriceReference, setLatestPriceReference] =
    useState<LatestValidProcurementForProduct | null>(null)

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

  const procurementSupplier =
    suppliers.find(
      (supplier) => supplier.id === procurementSupplierId,
    ) ?? null

  const procurementTotal = procurementItems.reduce(
    (total, item) => total + item.totalCost,
    0,
  )

  const procurementTotalQuantity = procurementItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )

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

  async function refreshProducts() {
    const savedProducts = await db.products.toArray()
    setProducts(savedProducts)
  }

  async function refreshSuppliers() {
    const savedSuppliers = await db.suppliers.toArray()
    setSuppliers(savedSuppliers)
  }

  function resetProcurementDraft() {
    setProcurementStage('idle')
    setProcurementSupplierId('')
    setProcurementDate('')
    setProcurementItems([])
    setItemProductId('')
    setItemQuantity('')
    setItemTotalCost('')
  }

  function handleStartNewProcurement() {
    setProcurementMessage('')
    setProcurementSupplierId('')
    setProcurementDate(getTodayDate())
    setProcurementItems([])
    setItemProductId('')
    setItemQuantity('')
    setItemTotalCost('')
    setProcurementStage('details')
  }

  function handleContinueProcurementDetails() {
    if (!procurementDate) {
      setProcurementMessage('Procurement date is required.')
      return
    }

    if (!procurementSupplierId) {
      setProcurementMessage('Supplier is required.')
      return
    }

    setProcurementMessage('')
    setProcurementStage('items')
  }

  function handleAddProcurementItem() {
    const quantity = Number(itemQuantity)
    const totalCost = Number(itemTotalCost)

    if (!itemProductId) {
      setProcurementMessage('Product is required.')
      return
    }

    if (
      procurementItems.some(
        (item) => item.productId === itemProductId,
      )
    ) {
      setProcurementMessage(
        'This product is already included in the procurement.',
      )
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setProcurementMessage(
        'Quantity must be greater than zero.',
      )
      return
    }

    if (!Number.isInteger(quantity)) {
      setProcurementMessage(
        'Quantity must be a whole number.',
      )
      return
    }

    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      setProcurementMessage(
        'Total cost must be greater than zero.',
      )
      return
    }

    const product = products.find(
      (candidate) => candidate.id === itemProductId,
    )

    if (!product) {
      setProcurementMessage('Product was not found.')
      return
    }

    setProcurementItems((currentItems) => [
      ...currentItems,
      {
        productId: itemProductId,
        quantity,
        totalCost,
        appliedSellingPrice: product.sellingPrice,
      },
    ])

    setItemProductId('')
    setItemQuantity('')
    setItemTotalCost('')
    setProcurementMessage('')
  }

  function handleRemoveProcurementItem(productId: string) {
    setProcurementItems((currentItems) =>
      currentItems.filter(
        (item) => item.productId !== productId,
      ),
    )
  }

  function handleReviewProcurement() {
    if (procurementItems.length === 0) {
      setProcurementMessage(
        'Add at least one product before reviewing the procurement.',
      )
      return
    }

    setProcurementMessage('')
    setProcurementStage('review')
  }

  function handleAppliedPriceChange(
    productId: string,
    value: string,
  ) {
    const newPrice = Number(value)

    setProcurementItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              appliedSellingPrice:
                value === '' ? undefined : newPrice,
            }
          : item,
      ),
    )
  }

  async function handleSaveProcurement() {
    try {
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
      setProductCategoryId('')
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
          <h2>New Procurement</h2>

          <button onClick={handleStartNewProcurement}>
            New Procurement
          </button>

          {procurementMessage && <p>{procurementMessage}</p>}
        </section>
      )
    }

    if (procurementStage === 'details') {
      return (
        <section>
          <h2>New Procurement</h2>

          <h3>Procurement Details</h3>

          <label>
            Procurement Date
            <input
              type="date"
              value={procurementDate}
              onChange={(event) =>
                setProcurementDate(event.target.value)
              }
            />
          </label>

          <label>
            Supplier
            <select
              value={procurementSupplierId}
              onChange={(event) =>
                setProcurementSupplierId(event.target.value)
              }
            >
              <option value="">Select a supplier</option>

              {suppliers.map((supplier) => (
                <option
                  key={supplier.id}
                  value={supplier.id}
                >
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => {
              resetProcurementDraft()
              setProcurementMessage('')
            }}
          >
            Cancel
          </button>

          <button onClick={handleContinueProcurementDetails}>
            Continue
          </button>

          {procurementMessage && <p>{procurementMessage}</p>}
        </section>
      )
    }

    if (procurementStage === 'items') {
      return (
        <section>
          <h2>New Procurement</h2>

          <p>Date: {procurementDate}</p>

          <p>
            Supplier: {procurementSupplier?.name ?? '-'}
          </p>

          <h3>Add Products</h3>

          <label>
            Product
            <select
              value={itemProductId}
              onChange={(event) =>
                setItemProductId(event.target.value)
              }
            >
              <option value="">Select a product</option>

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

          <label>
            Quantity
            <input
              type="number"
              min="1"
              step="1"
              value={itemQuantity}
              onChange={(event) =>
                setItemQuantity(event.target.value)
              }
            />
          </label>

          <label>
            Total Cost
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={itemTotalCost}
              onChange={(event) =>
                setItemTotalCost(event.target.value)
              }
            />
          </label>

          <button onClick={handleAddProcurementItem}>
            Add Product
          </button>

          {procurementItems.length > 0 && (
            <>
              <h3>Procurement Items</h3>

              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Total Cost</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {procurementItems.map((item) => {
                    const product = products.find(
                      (candidate) =>
                        candidate.id === item.productId,
                    )

                    return (
                      <tr key={item.productId}>
                        <td>
                          {product?.name ?? 'Unknown product'}
                        </td>
                        <td>{item.quantity}</td>
                        <td>₱{item.totalCost.toFixed(2)}</td>
                        <td>
                          <button
                            onClick={() =>
                              handleRemoveProcurementItem(
                                item.productId,
                              )
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <p>
                Total Quantity: {procurementTotalQuantity}
              </p>

              <p>
                Total Procurement Cost: ₱
                {procurementTotal.toFixed(2)}
              </p>
            </>
          )}

          <button
            onClick={() => {
              setProcurementMessage('')
              setProcurementStage('details')
            }}
          >
            Back
          </button>

          <button onClick={handleReviewProcurement}>
            Review Procurement
          </button>

          {procurementMessage && <p>{procurementMessage}</p>}
        </section>
      )
    }

    return (
      <section>
        <h2>Procurement Summary</h2>

        <p>Date: {procurementDate}</p>

        <p>
          Supplier: {procurementSupplier?.name ?? '-'}
        </p>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Total Cost</th>
              <th>Unit Cost</th>
              <th>Previous Price</th>
              <th>Recommended Price</th>
              <th>Final Price</th>
            </tr>
          </thead>

          <tbody>
            {procurementItems.map((item) => {
              const product = products.find(
                (candidate) =>
                  candidate.id === item.productId,
              )

              const {
                unitCost,
                suggestedSellingPrice,
              } = calculateProcurementValues(
                item.quantity,
                item.totalCost,
              )

              const finalPrice =
                item.appliedSellingPrice ?? 0

              return (
                <tr key={item.productId}>
                  <td>
                    {product?.name ?? 'Unknown product'}
                  </td>

                  <td>{item.quantity}</td>

                  <td>
                    ₱{item.totalCost.toFixed(2)}
                  </td>

                  <td>
                    ₱{unitCost.toFixed(2)}
                  </td>

                  <td>
                    {product && product.sellingPrice > 0
                      ? `₱${product.sellingPrice.toFixed(2)}`
                      : 'Not set'}
                  </td>

                  <td>
                    ₱{suggestedSellingPrice.toFixed(2)}
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        item.appliedSellingPrice ?? ''
                      }
                      onChange={(event) =>
                        handleAppliedPriceChange(
                          item.productId,
                          event.target.value,
                        )
                      }
                    />

                    {finalPrice <= 0 && (
                      <p>
                        Set a selling price before saving.
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <p>
          Total Quantity: {procurementTotalQuantity}
        </p>

        <p>
          Total Procurement Cost: ₱
          {procurementTotal.toFixed(2)}
        </p>

        <button
          onClick={() => {
            setProcurementMessage('')
            setProcurementStage('items')
          }}
        >
          Back
        </button>

        <button onClick={handleSaveProcurement}>
          Save Procurement
        </button>

        {procurementMessage && <p>{procurementMessage}</p>}
      </section>
    )
  }

  function renderCurrentPage() {
    if (currentPage === 'procurement') {
      return (
        <main>
          <h1>Procurement</h1>

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

                <label>
                  Category
                  <select
                    value={productCategoryId}
                    onChange={(event) =>
                      setProductCategoryId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Select a category
                    </option>

                    {orderedCategories
                      .filter((category) => category.active)
                      .map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>

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
          <h1>Products</h1>

          {categorizedProducts.map(
            ({ category, products: categoryProducts }) => (
              <section key={category.id}>
                <h2>{category.name}</h2>

                {categoryProducts.map((product) => (
                  <button
                    className="product-button"
                    key={product.id}
                  >
                    {product.name}

                    <span>
                      {product.sellingPrice > 0
                        ? `₱${product.sellingPrice.toFixed(2)}`
                        : 'Price not set'}
                    </span>

                    <span>
                      Stock: {product.currentStockCache}
                    </span>
                  </button>
                ))}
              </section>
            ),
          )}

          {uncategorizedProducts.length > 0 && (
            <section>
              <h2>Uncategorized</h2>

              {uncategorizedProducts.map((product) => (
                <button
                  className="product-button"
                  key={product.id}
                >
                  {product.name}

                  <span>
                    {product.sellingPrice > 0
                      ? `₱${product.sellingPrice.toFixed(2)}`
                      : 'Price not set'}
                  </span>
                </button>
              ))}
            </section>
          )}
        </section>

        <section className="cart-panel">
          <h1>Cart</h1>
          <p>Cart behavior will be added later.</p>
        </section>
      </main>
    )
  }

  return (
    <>
      <header className="app-header">
        <UpdatePrompt appVersion={APP_VERSION} />
      </header>

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
          onClick={() => setCurrentPage('procurement')}
        >
          Procurement
        </button>

        <button
          className={
            currentPage === 'ledgers'
              ? 'nav-button active'
              : 'nav-button'
          }
          onClick={() => setCurrentPage('ledgers')}
        >
          Ledgers
        </button>
      </nav>

      {renderCurrentPage()}
    </>
  )
}

export default App