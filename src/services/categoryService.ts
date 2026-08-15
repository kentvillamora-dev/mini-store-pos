import { db } from '../db/database'

const DEFAULT_CATEGORIES = [
  {
    id: 'category-default-beverages',
    name: 'Beverages',
  },
  {
    id: 'category-default-snacks',
    name: 'Snacks',
  },
  {
    id: 'category-default-canned-goods',
    name: 'Canned Goods',
  },
  {
    id: 'category-default-instant-noodles',
    name: 'Instant Noodles',
  },
  {
    id: 'category-default-cooking-essentials',
    name: 'Cooking Essentials',
  },
  {
    id: 'category-default-milk-and-coffee',
    name: 'Milk and Coffee',
  },
  {
    id: 'category-default-personal-care',
    name: 'Personal Care',
  },
  {
    id: 'category-default-household-cleaning',
    name: 'Household Cleaning',
  },
  {
    id: 'category-default-cigarettes',
    name: 'Cigarettes',
  },
  {
    id: 'category-default-miscellaneous',
    name: 'Miscellaneous',
  },
]

function normalizeCategoryName(name: string) {
  return name.trim().toLocaleLowerCase()
}

export async function createCategory(name: string) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('Category name is required.')
  }

  const existingCategories = await db.categories.toArray()

  const duplicateCategory = existingCategories.find(
    (category) =>
      normalizeCategoryName(category.name) ===
      normalizeCategoryName(trimmedName),
  )

  if (duplicateCategory) {
    throw new Error('Category name already exists.')
  }

  const now = new Date().toISOString()

  await db.categories.add({
    id: crypto.randomUUID(),
    name: trimmedName,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
}

export async function initializeDefaultCategories() {
  await db.transaction(
    'rw',
    db.categories,
    db.products,
    async () => {
      const now = new Date().toISOString()

      for (const defaultCategory of DEFAULT_CATEGORIES) {
        const normalizedDefaultName =
          normalizeCategoryName(defaultCategory.name)

        const allCategories = await db.categories.toArray()

        const matchingCategories = allCategories.filter(
          (category) =>
            normalizeCategoryName(category.name) ===
            normalizedDefaultName,
        )

        let canonicalCategory = matchingCategories.find(
          (category) =>
            category.id === defaultCategory.id,
        )

        if (!canonicalCategory) {
          canonicalCategory = {
            id: defaultCategory.id,
            name: defaultCategory.name,
            active: true,
            createdAt: now,
            updatedAt: now,
          }

          await db.categories.put(canonicalCategory)
        } else if (
          canonicalCategory.name !== defaultCategory.name ||
          !canonicalCategory.active
        ) {
          await db.categories.update(canonicalCategory.id, {
            name: defaultCategory.name,
            active: true,
            updatedAt: now,
          })
        }

        const duplicateCategories = matchingCategories.filter(
          (category) =>
            category.id !== defaultCategory.id,
        )

        for (const duplicateCategory of duplicateCategories) {
          await db.products
            .where('categoryId')
            .equals(duplicateCategory.id)
            .modify({
              categoryId: defaultCategory.id,
              updatedAt: now,
            })

          await db.categories.delete(duplicateCategory.id)
        }
      }
    },
  )
}