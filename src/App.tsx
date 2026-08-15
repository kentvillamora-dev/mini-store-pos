import { useEffect, useState } from 'react'
import {
  db,
  type Procurement,
  type Product,
  type Supplier,
} from './db/database'
import DataViewer from './features/dataViewer/DataViewer'
import UpdatePrompt from './features/pwa/UpdatePrompt'
import { createProduct } from './services/productService'
import {
  createProcurement,
  findPotentialDuplicateProcurement,
  getLatestValidProcurementForProduct,
} from './services/procurementService'
import { setProductPrice } from './services/priceService'
import { createSupplier } from './services/supplierService'
import { calculateSuggestedSellingPrice } from './utils/pricing'

type AppPage = 'pos' | 'procurement' | 'ledgers'

const APP_VERSION = '2026.08.15.1'

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [currentPage, setCurrentPage] = useState<AppPage>('pos')

  const [productName, setProductName] = useState('')
  const [productMessage, setProductMessage] = useState('')

  const [supplierName, setSupplierName] = useState('')
  const [supplierMessage, setSupplierMessage] = useState('')

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [procurementDate, setProcurementDate] = useState('')
  const [procurementQuantity, setProcurementQuantity] = useState('')
  const [procurementCost, setProcurementCost] = useState('')
  const [procurementMessage, setProcurementMessage] = useState('')

  const [priceProductId, setPriceProductId] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [priceMessage, setPriceMessage] = useState('')
  const [latestPriceProcurement, setLatestPriceProcurement] =
    useState<Procurement | null>(null)

  const quantityNumber = Number(procurementQuantity)
  const procurementCostNumber = Number(procurementCost)

  const unitCost =
    quantityNumber > 0 && procurementCostNumber > 0
      ? procurementCostNumber / quantityNumber
      : null

  const suggestedSrp =
    unitCost !== null
      ? calculateSuggestedSellingPrice(unitCost)
      : null

  const priceProduct =
    products.find((product) => product.id === priceProductId) ?? null

  const latestPriceSupplier =
    latestPriceProcurement?.supplierId
      ? suppliers.find(
          (supplier) =>
            supplier.id === latestPriceProcurement.supplierId,
        ) ?? null
      : null

  useEffect(() => {
    async function loadData() {
      const savedProducts = await db.products.toArray()
      setProducts(savedProducts)

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

      const latestProcurement =
        await getLatestValidProcurementForProduct(priceProductId)

      setLatestPriceProcurement(latestProcurement ?? null)
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

  async function handleCreateProduct() {
    try {
      await createProduct(productName)

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
    setLatestPriceProcurement(null)

    if (!productId) {
      return
    }

    const latestProcurement =
      await getLatestValidProcurementForProduct(productId)

    setLatestPriceProcurement(latestProcurement ?? null)
  }

  async function handleSetProductPrice() {
    try {
      await setProductPrice({
        productId: priceProductId,
        newPrice: Number(newSellingPrice),
        procurementId: latestPriceProcurement?.id,
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

  async function handleSaveProcurement() {
    try {
      const input = {
        productId: selectedProductId,
        supplierId: selectedSupplierId || undefined,
        procurementDate,
        quantity: quantityNumber,
        totalCost: procurementCostNumber,
      }

      const duplicate =
        await findPotentialDuplicateProcurement(input)

      if (duplicate) {
        const supplierName =
          suppliers.find(
            (supplier) => supplier.id === duplicate.supplierId,
          )?.name ?? 'Unknown supplier'

        const shouldSave = window.confirm(
          `A similar procurement has already been recorded.\n\n` +
            `Procurement date: ${duplicate.procurementDate}\n` +
            `Supplier name: ${supplierName}\n` +
            `Existing quantity: ${duplicate.quantity}\n` +
            `Existing total cost: ₱${duplicate.totalCost.toFixed(2)}\n\n` +
            `Save this as another valid procurement?`,
        )

        if (!shouldSave) {
          setProcurementMessage('Procurement cancelled.')
          return
        }
      }

      await createProcurement(input)

      setProcurementMessage('Procurement saved.')
    } catch (error) {
      if (error instanceof Error) {
        setProcurementMessage(error.message)
        return
      }

      setProcurementMessage('Unable to save procurement.')
    }
  }

  function renderCurrentPage() {
    if (currentPage === 'procurement') {
      return (
        <main>
          <h1>Procurement</h1>

          <section>
            <h2>Restock Product</h2>

            <label>
              Supplier
              <select
                value={selectedSupplierId}
                onChange={(event) =>
                  setSelectedSupplierId(event.target.value)
                }
              >
                <option value="">No supplier selected</option>

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

            <label>
              Product
              <select
                value={selectedProductId}
                onChange={(event) =>
                  setSelectedProductId(event.target.value)
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
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                value={procurementQuantity}
                onChange={(event) =>
                  setProcurementQuantity(event.target.value)
                }
              />
            </label>

            {procurementQuantity !== '' &&
              Number(procurementQuantity) <= 0 && (
                <p>Quantity must be greater than zero.</p>
              )}

            <label>
              Procurement Cost
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={procurementCost}
                onChange={(event) =>
                  setProcurementCost(event.target.value)
                }
              />
            </label>

            {procurementCost !== '' &&
              Number(procurementCost) <= 0 && (
                <p>Procurement cost must be greater than zero.</p>
              )}

            {unitCost !== null && (
              <p>Unit Cost: ₱{unitCost.toFixed(2)}</p>
            )}

            {suggestedSrp !== null && (
              <p>Suggested SRP: ₱{suggestedSrp.toFixed(2)}</p>
            )}

            <button onClick={handleSaveProcurement}>
              Save Procurement
            </button>

            {procurementMessage && <p>{procurementMessage}</p>}
          </section>

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
                  handlePriceProductChange(event.target.value)
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

            {priceProduct && (
              <>
                <p>
                  Current Selling Price: ₱
                  {priceProduct.sellingPrice.toFixed(2)}
                </p>

                {latestPriceProcurement ? (
                  <>
                    <h3>Latest Procurement</h3>

                    <p>
                      Date: {latestPriceProcurement.procurementDate}
                    </p>

                    <p>
                      Supplier:{' '}
                      {latestPriceSupplier?.name ??
                        'Unknown supplier'}
                    </p>

                    <p>
                      Unit Cost: ₱
                      {latestPriceProcurement.unitCost.toFixed(2)}
                    </p>

                    <p>
                      Suggested SRP: ₱
                      {latestPriceProcurement.suggestedSellingPrice.toFixed(
                        2,
                      )}
                    </p>
                  </>
                ) : (
                  <p>No valid procurement history found.</p>
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
                  setNewSellingPrice(event.target.value)
                }
              />
            </label>

            {newSellingPrice !== '' &&
              Number(newSellingPrice) <= 0 && (
                <p>Selling price must be greater than zero.</p>
              )}

            <button onClick={handleSetProductPrice}>
              Set Price
            </button>

            {priceMessage && <p>{priceMessage}</p>}
          </section>
        </main>
      )
    }

    if (currentPage === 'ledgers') {
      return (
        <main>
          <DataViewer onSuppliersChanged={refreshSuppliers} />
        </main>
      )
    }

    return (
      <main className="pos-layout">
        <section className="products-panel">
          <h1>Products</h1>

          {products.map((product) => (
            <button
              className="product-button"
              key={product.id}
            >
              {product.name}
              <span>₱{product.sellingPrice.toFixed(2)}</span>
            </button>
          ))}
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
      <UpdatePrompt />

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

      <small>Version {APP_VERSION}</small>

      {renderCurrentPage()}
    </>
  )
}

export default App