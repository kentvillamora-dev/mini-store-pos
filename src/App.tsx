import { useState } from 'react'

function App() {
  const [cartCount, setCartCount] = useState(0)
  const sardinesPrice = 25
  const total = cartCount * sardinesPrice

  function addSardinesToCart() {
    setCartCount(cartCount + 1)
  }

  return (
    <main className="pos-layout">
      <section className="products-panel">
        <h1>Products</h1>

        <button
          className="product-button"
          onClick={addSardinesToCart}
        >
          Sardines
          <span>₱25.00</span>
        </button>
      </section>

      <section className="cart-panel">
        <h1>Cart</h1>

        <p>Sardines: {cartCount}</p>

        <h2>
          Total: ₱{total.toFixed(2)}
        </h2>
      </section>
    </main>
  )
}

export default App