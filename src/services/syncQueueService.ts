import {
  db,
  type SyncEntityType,
  type SyncQueueItem,
} from '../db/database'

const LAST_SUCCESSFUL_SYNC_SETTING_KEY =
  'sync.lastSuccessfulAt'

export interface SyncQueueSummary {
  pendingCount: number
  failedCount: number
  totalUnsyncedCount: number
  lastSuccessfulSyncAt: string | null
}

export async function enqueueEntityForSync(
  entityType: SyncEntityType,
  entityId: string,
) {
  if (!entityId.trim()) {
    throw new Error(
      'Cannot queue a record without an entity ID.',
    )
  }

  const existingQueueItem =
    await db.syncQueue
      .where('[entityType+entityId]')
      .equals([
        entityType,
        entityId,
      ])
      .first()

  if (existingQueueItem) {
    await db.syncQueue.update(
      existingQueueItem.id,
      {
        status: 'PENDING',
        attemptCount: 0,
        lastAttemptAt: undefined,
        lastError: undefined,
      },
    )

    return (
      (await db.syncQueue.get(
        existingQueueItem.id,
      )) ?? existingQueueItem
    )
  }

  const queueItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    entityType,
    entityId,
    status: 'PENDING',
    attemptCount: 0,
    createdAt: new Date().toISOString(),
  }

  await db.syncQueue.add(queueItem)

  return queueItem
}

export async function getSyncQueueItems(
  limit = 50,
) {
  if (
    !Number.isInteger(limit) ||
    limit <= 0
  ) {
    throw new Error(
      'Sync queue limit must be a positive whole number.',
    )
  }

  return db.syncQueue
    .orderBy('createdAt')
    .limit(limit)
    .toArray()
}

export async function markSyncAttemptFailed(
  queueItemId: string,
  errorMessage: string,
) {
  const queueItem =
    await db.syncQueue.get(
      queueItemId,
    )

  if (!queueItem) {
    return
  }

  await db.syncQueue.update(
    queueItemId,
    {
      status: 'FAILED',
      attemptCount:
        queueItem.attemptCount + 1,
      lastAttemptAt:
        new Date().toISOString(),
      lastError:
        errorMessage.trim() ||
        'Unknown synchronization error.',
    },
  )
}

export async function markSyncBatchSuccessful(
  queueItemIds: string[],
) {
  if (queueItemIds.length === 0) {
    return
  }

  const successfulAt =
    new Date().toISOString()

  await db.transaction(
    'rw',
    db.syncQueue,
    db.appSettings,
    async () => {
      await db.syncQueue.bulkDelete(
        queueItemIds,
      )

      await db.appSettings.put({
        key:
          LAST_SUCCESSFUL_SYNC_SETTING_KEY,
        value: successfulAt,
      })
    },
  )
}

export async function getLastSuccessfulSyncAt() {
  const setting =
    await db.appSettings.get(
      LAST_SUCCESSFUL_SYNC_SETTING_KEY,
    )

  return setting?.value ?? null
}

export async function getSyncQueueSummary(): Promise<SyncQueueSummary> {
  const [
    pendingCount,
    failedCount,
    lastSuccessfulSyncAt,
  ] = await Promise.all([
    db.syncQueue
      .where('status')
      .equals('PENDING')
      .count(),

    db.syncQueue
      .where('status')
      .equals('FAILED')
      .count(),

    getLastSuccessfulSyncAt(),
  ])

  return {
    pendingCount,
    failedCount,
    totalUnsyncedCount:
      pendingCount + failedCount,
    lastSuccessfulSyncAt,
  }
}