import { db, type Supplier } from '../db/database'

export async function createSupplier(name: string): Promise<Supplier> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Supplier name is required.')

  const existingSuppliers = await db.suppliers.toArray()
  const duplicateSupplier = existingSuppliers.find(
    (supplier) =>
      supplier.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
  )

  if (duplicateSupplier) throw new Error('Supplier name already exists.')

  const now = new Date().toISOString()
  const supplier: Supplier = {
    id: crypto.randomUUID(),
    name: trimmedName,
    active: true,
    createdAt: now,
    updatedAt: now,
  }

  await db.suppliers.add(supplier)
  return supplier
}

export async function deleteSupplier(supplierId: string) {
  const linkedProcurement = await db.procurements
    .where('supplierId')
    .equals(supplierId)
    .first()

  if (linkedProcurement) {
    throw new Error(
      'Supplier cannot be deleted because it is already used in procurement history.',
    )
  }

  await db.suppliers.delete(supplierId)
}
