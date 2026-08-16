import { useEffect, useMemo, useState } from 'react'
import {
  db,
  type Category,
  type Product,
} from '../../db/database'
import {
  createInventoryReconciliation,
  type InventoryReconciliationInputItem,
} from '../../services/inventoryReconciliationService'

type ReconciliationStage =
  | 'idle'
  | 'counting'
  | 'review'

interface DraftCountItem {
  productId: string
  physicalQuantity: string
}

interface InventoryReconciliationPanelProps {
  onProductsChanged: () => Promise<void>
}

function getTodayDate() {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, '0')
  const day = String(
    now.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function InventoryReconciliationPanel({
  onProductsChanged,
}: InventoryReconciliationPanelProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [stage, setStage] =
    useState<ReconciliationStage>('idle')

  const [reconciliationDate, setReconciliationDate] =
    useState('')

  const [draftItems, setDraftItems] = useState<
    DraftCountItem[]
  >([])

  const [productSelectorOpen, setProductSelectorOpen] =
    useState(false)

  const [productSearch, setProductSearch] =
    useState('')

  const [reason, setReason] =
    useState('Periodic physical count')

  const [note, setNote] =
    useState('')

  const [message, setMessage] =
    useState('')

  useEffect(() => {
    async function loadData() {
      const productRecords =
        await db.products.toArray()

      setProducts(productRecords)

      const categoryRecords =
        await db.categories.toArray()

      setCategories(categoryRecords)
    }

    loadData()
  }, [])

  const activeProducts = useMemo(
    () =>
      [...products]
        .filter((product) => product.active)
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            'en',
            {
              sensitivity: 'base',
            },
          ),
        ),
    [products],
  )

  const activeCategories = useMemo(
    () =>
      [...categories]
        .filter((category) => category.active)
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            'en',
            {
              sensitivity: 'base',
            },
          ),
        ),
    [categories],
  )

  const filteredProducts = useMemo(() => {
    const searchTerm =
      productSearch.trim().toLocaleLowerCase()

    if (!searchTerm) {
      return activeProducts
    }

    return activeProducts.filter((product) =>
      product.name
        .toLocaleLowerCase()
        .includes(searchTerm),
    )
  }, [
    activeProducts,
    productSearch,
  ])

  const groupedProducts = useMemo(() => {
    const groups = activeCategories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        products: filteredProducts.filter(
          (product) =>
            product.categoryId ===
            category.id,
        ),
      }))
      .filter(
        (group) =>
          group.products.length > 0,
      )

    const uncategorizedProducts =
      filteredProducts.filter(
        (product) => {
          if (!product.categoryId) {
            return true
          }

          return !categories.some(
            (category) =>
              category.id ===
              product.categoryId,
          )
        },
      )

    if (
      uncategorizedProducts.length > 0
    ) {
      groups.push({
        categoryId:
          '__uncategorized__',
        categoryName:
          'Uncategorized',
        products:
          uncategorizedProducts,
      })
    }

    return groups
  }, [
    activeCategories,
    categories,
    filteredProducts,
  ])

  function getProduct(
    productId: string,
  ) {
    return (
      products.find(
        (product) =>
          product.id === productId,
      ) ?? null
    )
  }

  function isProductSelected(
    productId: string,
  ) {
    return draftItems.some(
      (item) =>
        item.productId === productId,
    )
  }

  function resetDraft() {
    setStage('idle')
    setReconciliationDate('')
    setDraftItems([])
    setProductSelectorOpen(false)
    setProductSearch('')
    setReason(
      'Periodic physical count',
    )
    setNote('')
    setMessage('')
  }

  function handleStartCount() {
    setReconciliationDate(
      getTodayDate(),
    )
    setDraftItems([])
    setProductSelectorOpen(true)
    setProductSearch('')
    setReason(
      'Periodic physical count',
    )
    setNote('')
    setMessage('')
    setStage('counting')
  }

  function handleProductSelectionChange(
    productId: string,
    selected: boolean,
  ) {
    setDraftItems(
      (currentItems) => {
        if (selected) {
          const alreadySelected =
            currentItems.some(
              (item) =>
                item.productId ===
                productId,
            )

          if (alreadySelected) {
            return currentItems
          }

          return [
            ...currentItems,
            {
              productId,
              physicalQuantity: '',
            },
          ]
        }

        return currentItems.filter(
          (item) =>
            item.productId !==
            productId,
        )
      },
    )

    setMessage('')
  }

  function handleSelectCategoryProducts(
    categoryProducts: Product[],
  ) {
    setDraftItems(
      (currentItems) => {
        const existingIds =
          new Set(
            currentItems.map(
              (item) =>
                item.productId,
            ),
          )

        const newItems =
          categoryProducts
            .filter(
              (product) =>
                !existingIds.has(
                  product.id,
                ),
            )
            .map(
              (product) => ({
                productId:
                  product.id,
                physicalQuantity:
                  '',
              }),
            )

        return [
          ...currentItems,
          ...newItems,
        ]
      },
    )

    setMessage('')
  }

  function handleClearCategoryProducts(
    categoryProducts: Product[],
  ) {
    const categoryProductIds =
      new Set(
        categoryProducts.map(
          (product) =>
            product.id,
        ),
      )

    setDraftItems(
      (currentItems) =>
        currentItems.filter(
          (item) =>
            !categoryProductIds.has(
              item.productId,
            ),
        ),
    )

    setMessage('')
  }

  function handleClearSelection() {
    setDraftItems([])
    setMessage('')
  }

  function handleDoneSelecting() {
    if (draftItems.length === 0) {
      setMessage(
        'Select at least one product to count.',
      )
      return
    }

    setProductSelectorOpen(false)
    setProductSearch('')
    setMessage('')
  }

  function handlePhysicalQuantityChange(
    productId: string,
    value: string,
  ) {
    setDraftItems(
      (currentItems) =>
        currentItems.map(
          (item) =>
            item.productId ===
            productId
              ? {
                  ...item,
                  physicalQuantity:
                    value,
                }
              : item,
        ),
    )

    setMessage('')
  }

  function handleRemoveProduct(
    productId: string,
  ) {
    setDraftItems(
      (currentItems) =>
        currentItems.filter(
          (item) =>
            item.productId !==
            productId,
        ),
    )

    setMessage('')
  }

  function validateDraft() {
    if (!reconciliationDate) {
      setMessage(
        'Reconciliation date is required.',
      )
      return false
    }

    if (draftItems.length === 0) {
      setMessage(
        'Select at least one product to count.',
      )
      return false
    }

    for (const item of draftItems) {
      if (
        item.physicalQuantity === ''
      ) {
        const product =
          getProduct(
            item.productId,
          )

        setMessage(
          `Enter the physical count for ${
            product?.name ??
            'each product'
          }.`,
        )

        return false
      }

      const physicalQuantity =
        Number(
          item.physicalQuantity,
        )

      if (
        !Number.isFinite(
          physicalQuantity,
        ) ||
        !Number.isInteger(
          physicalQuantity,
        ) ||
        physicalQuantity < 0
      ) {
        const product =
          getProduct(
            item.productId,
          )

        setMessage(
          `${
            product?.name ??
            'Physical quantity'
          } must be a whole number zero or greater.`,
        )

        return false
      }
    }

    return true
  }

  async function handleReview() {
    if (!validateDraft()) {
      return
    }

    const currentProducts =
      await db.products.toArray()

    setProducts(
      currentProducts,
    )

    setProductSelectorOpen(false)
    setProductSearch('')
    setMessage('')
    setStage('review')
  }

  function handleBackToCounting() {
    setMessage('')
    setStage('counting')
  }

  function getVariance(
    item: DraftCountItem,
  ) {
    const product =
      getProduct(
        item.productId,
      )

    if (!product) {
      return 0
    }

    return (
      Number(
        item.physicalQuantity,
      ) -
      product.currentStockCache
    )
  }

  const countedItemCount =
    draftItems.length

  const adjustedItemCount =
    draftItems.filter(
      (item) =>
        getVariance(item) !== 0,
    ).length

  async function handleConfirm() {
    if (!validateDraft()) {
      return
    }

    if (!reason.trim()) {
      setMessage(
        'Reconciliation reason is required.',
      )
      return
    }

    try {
      setMessage('')

      const items: InventoryReconciliationInputItem[] =
        draftItems.map(
          (item) => ({
            productId:
              item.productId,
            physicalQuantity:
              Number(
                item.physicalQuantity,
              ),
          }),
        )

      const result =
        await createInventoryReconciliation(
          {
            reconciliationDate,
            reason,
            note,
            items,
          },
        )

      const refreshedProducts =
        await db.products.toArray()

      setProducts(
        refreshedProducts,
      )

      await onProductsChanged()

      setStage('idle')
      setReconciliationDate('')
      setDraftItems([])
      setProductSelectorOpen(false)
      setProductSearch('')
      setReason(
        'Periodic physical count',
      )
      setNote('')

      setMessage(
        `Inventory reconciliation completed. ${result.reconciliation.countedItemCount} product${
          result.reconciliation.countedItemCount ===
          1
            ? ''
            : 's'
        } counted; ${result.reconciliation.adjustedItemCount} adjusted.`,
      )
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setMessage(
          error.message,
        )
        return
      }

      setMessage(
        'Unable to complete inventory reconciliation.',
      )
    }
  }

  if (stage === 'idle') {
    return (
      <section>
        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: '12px',
            flexWrap:
              'wrap',
          }}
        >
          <div>
            <h2
              style={{
                marginBottom:
                  '4px',
              }}
            >
              Inventory Reconciliation
            </h2>

            <p
              style={{
                margin: 0,
                color:
                  'var(--color-text-muted)',
              }}
            >
              Record physical counts and correct inventory differences.
            </p>
          </div>

          <button
            onClick={
              handleStartCount
            }
          >
            Start Count
          </button>
        </div>

        {message && (
          <p
            style={{
              marginTop:
                '12px',
              fontWeight:
                600,
            }}
          >
            {message}
          </p>
        )}
      </section>
    )
  }

  if (stage === 'counting') {
    return (
      <section>
        <h2>
          Inventory Count
        </h2>

        <label>
          Reconciliation Date
          <input
            type="date"
            value={
              reconciliationDate
            }
            onChange={(
              event,
            ) => {
              setReconciliationDate(
                event.target
                  .value,
              )
              setMessage('')
            }}
          />
        </label>

        <div
          style={{
            marginBottom:
              '18px',
          }}
        >
          <button
            type="button"
            onClick={() =>
              setProductSelectorOpen(
                (current) =>
                  !current,
              )
            }
            aria-expanded={
              productSelectorOpen
            }
            style={{
              width: '100%',
              margin: 0,
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'space-between',
              gap: '12px',
              textAlign: 'left',
            }}
          >
            <span>
              Select Products
            </span>

            <span
              style={{
                display:
                  'inline-flex',
                alignItems:
                  'center',
                gap: '8px',
              }}
            >
              <strong>
                {
                  draftItems.length
                }{' '}
                selected
              </strong>

              <span>
                {productSelectorOpen
                  ? '▲'
                  : '▼'}
              </span>
            </span>
          </button>

          {productSelectorOpen && (
            <div
              style={{
                marginTop:
                  '6px',
                padding:
                  '12px',
                background:
                  'var(--color-surface)',
                border:
                  '1px solid var(--color-border)',
                borderRadius:
                  'var(--radius-md)',
              }}
            >
              <label
                style={{
                  marginBottom:
                    '10px',
                }}
              >
                Search Products
                <input
                  type="search"
                  value={
                    productSearch
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductSearch(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Search by product name"
                />
              </label>

              <div
                style={{
                  maxHeight:
                    '320px',
                  overflowY:
                    'auto',
                  borderTop:
                    '1px solid var(--color-border-light)',
                  borderBottom:
                    '1px solid var(--color-border-light)',
                }}
              >
                {groupedProducts.length ===
                0 ? (
                  <p
                    style={{
                      margin:
                        '16px 8px',
                    }}
                  >
                    No matching products found.
                  </p>
                ) : (
                  groupedProducts.map(
                    (group) => {
                      const selectedInGroup =
                        group.products.filter(
                          (
                            product,
                          ) =>
                            isProductSelected(
                              product.id,
                            ),
                        ).length

                      const allSelected =
                        group.products
                          .length > 0 &&
                        selectedInGroup ===
                          group.products
                            .length

                      return (
                        <div
                          key={
                            group.categoryId
                          }
                          style={{
                            padding:
                              '12px 4px',
                            borderBottom:
                              '1px solid var(--color-border-light)',
                          }}
                        >
                          <div
                            style={{
                              display:
                                'flex',
                              alignItems:
                                'center',
                              justifyContent:
                                'space-between',
                              gap:
                                '8px',
                              marginBottom:
                                '6px',
                            }}
                          >
                            <strong>
                              {
                                group.categoryName
                              }
                            </strong>

                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  allSelected
                                ) {
                                  handleClearCategoryProducts(
                                    group.products,
                                  )
                                } else {
                                  handleSelectCategoryProducts(
                                    group.products,
                                  )
                                }
                              }}
                              style={{
                                minHeight:
                                  '32px',
                                margin:
                                  0,
                                padding:
                                  '4px 9px',
                                fontSize:
                                  '0.78rem',
                              }}
                            >
                              {allSelected
                                ? 'Clear'
                                : 'Select All'}
                            </button>
                          </div>

                          {group.products.map(
                            (
                              product,
                            ) => (
                              <label
                                key={
                                  product.id
                                }
                                style={{
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  gap:
                                    '10px',
                                  margin:
                                    0,
                                  padding:
                                    '8px 6px',
                                  cursor:
                                    'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isProductSelected(
                                    product.id,
                                  )}
                                  onChange={(
                                    event,
                                  ) =>
                                    handleProductSelectionChange(
                                      product.id,
                                      event
                                        .target
                                        .checked,
                                    )
                                  }
                                  style={{
                                    width:
                                      '18px',
                                    minHeight:
                                      '18px',
                                    margin:
                                      0,
                                    flexShrink:
                                      0,
                                  }}
                                />

                                <span>
                                  {
                                    product.name
                                  }
                                </span>
                              </label>
                            ),
                          )}
                        </div>
                      )
                    },
                  )
                )}
              </div>

              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap:
                    '10px',
                  marginTop:
                    '12px',
                  flexWrap:
                    'wrap',
                }}
              >
                <strong>
                  {
                    draftItems.length
                  }{' '}
                  Product
                  {draftItems.length ===
                  1
                    ? ''
                    : 's'}{' '}
                  Selected
                </strong>

                <div
                  style={{
                    display:
                      'flex',
                    gap:
                      '8px',
                    flexWrap:
                      'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={
                      handleClearSelection
                    }
                    disabled={
                      draftItems.length ===
                      0
                    }
                    style={{
                      margin:
                        0,
                    }}
                  >
                    Clear Selection
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleDoneSelecting
                    }
                    style={{
                      margin:
                        0,
                      background:
                        'var(--color-primary)',
                      borderColor:
                        'var(--color-primary)',
                      color:
                        '#ffffff',
                    }}
                  >
                    Done Selecting
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {draftItems.length ===
        0 ? (
          <p>
            No products selected
            for this count yet.
          </p>
        ) : (
          <>
            <p
              style={{
                marginBottom:
                  '8px',
                color:
                  'var(--color-text-muted)',
              }}
            >
              Enter the physical quantity for each selected Product.
            </p>

            <table>
              <thead>
                <tr>
                  <th>
                    Product
                  </th>

                  <th>
                    Physical Count
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {draftItems.map(
                  (item) => {
                    const product =
                      getProduct(
                        item.productId,
                      )

                    return (
                      <tr
                        key={
                          item.productId
                        }
                      >
                        <td>
                          {product?.name ??
                            'Unknown product'}
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              item.physicalQuantity
                            }
                            onChange={(
                              event,
                            ) =>
                              handlePhysicalQuantityChange(
                                item.productId,
                                event
                                  .target
                                  .value,
                              )
                            }
                          />
                        </td>

                        <td>
                          <button
                            onClick={() =>
                              handleRemoveProduct(
                                item.productId,
                              )
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  },
                )}
              </tbody>
            </table>
          </>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'flex-end',
            gap: '8px',
            flexWrap:
              'wrap',
          }}
        >
          <button
            onClick={
              resetDraft
            }
          >
            Cancel
          </button>

          <button
            onClick={
              handleReview
            }
          >
            Review Count
          </button>
        </div>

        {message && (
          <p
            style={{
              fontWeight:
                600,
            }}
          >
            {message}
          </p>
        )}
      </section>
    )
  }

  return (
    <section>
      <h2>
        Review Inventory Count
      </h2>

      <p>
        Review the current
        system stock against
        the physical counts.
        You can edit the
        physical count before
        confirming.
      </p>

      <table>
        <thead>
          <tr>
            <th>
              Product
            </th>

            <th>
              System
            </th>

            <th>
              Counted
            </th>

            <th>
              Variance
            </th>
          </tr>
        </thead>

        <tbody>
          {draftItems.map(
            (item) => {
              const product =
                getProduct(
                  item.productId,
                )

              const variance =
                getVariance(
                  item,
                )

              return (
                <tr
                  key={
                    item.productId
                  }
                >
                  <td>
                    {product?.name ??
                      'Unknown product'}
                  </td>

                  <td>
                    {product?.currentStockCache ??
                      '-'}
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        item.physicalQuantity
                      }
                      onChange={(
                        event,
                      ) =>
                        handlePhysicalQuantityChange(
                          item.productId,
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </td>

                  <td>
                    {variance > 0
                      ? `+${variance}`
                      : variance}
                  </td>
                </tr>
              )
            },
          )}
        </tbody>
      </table>

      <p>
        Products Counted:{' '}
        <strong>
          {countedItemCount}
        </strong>
      </p>

      <p>
        Products Requiring
        Adjustment:{' '}
        <strong>
          {adjustedItemCount}
        </strong>
      </p>

      <label>
        Reason
        <select
          value={reason}
          onChange={(
            event,
          ) => {
            setReason(
              event.target
                .value,
            )
            setMessage('')
          }}
        >
          <option value="Periodic physical count">
            Periodic physical count
          </option>

          <option value="Damaged or spoiled items">
            Damaged or spoiled items
          </option>

          <option value="Unrecorded consumption">
            Unrecorded consumption
          </option>

          <option value="Other">
            Other
          </option>
        </select>
      </label>

      <label>
        Note
        <textarea
          rows={3}
          value={note}
          onChange={(
            event,
          ) =>
            setNote(
              event.target
                .value,
            )
          }
          placeholder="Optional"
        />
      </label>

      <div
        style={{
          display: 'flex',
          justifyContent:
            'flex-end',
          gap: '8px',
          flexWrap:
            'wrap',
        }}
      >
        <button
          onClick={
            handleBackToCounting
          }
        >
          Back
        </button>

        <button
          onClick={
            handleConfirm
          }
        >
          Confirm Reconciliation
        </button>
      </div>

      {message && (
        <p
          style={{
            fontWeight: 600,
          }}
        >
          {message}
        </p>
      )}
    </section>
  )
}

export default InventoryReconciliationPanel