import { useEffect, useState } from 'react'
import { db, type Product } from './db/database'
import DataViewer from './features/dataViewer/DataViewer'

function App() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    async function loadProducts() {
      const existingSardines = await db.products.get('sample-sardines')

      if (!existingSardines) {
        const now = new Date().toISOString()

        await db.products.add({
          id: 'sample-sardines',
          name: 'Sardines',
          sellingPrice: 25,
          currentStockCache: 10,
          active: true,
          createdAt: now,
          updatedAt: now,
        })
      }

      const savedProducts = await db.products.toArray()
      setProducts(savedProducts)
    }

    loadProducts()
  }, [])

  return (
    <>
      `<main className="pos-layout">
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

      <DataViewer />
    </>
  )
}

export default App