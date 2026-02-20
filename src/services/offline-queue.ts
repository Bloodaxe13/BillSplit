/**
 * Offline queue for receipt uploads using expo-sqlite.
 *
 * When the device has no connectivity, captured photos are stored locally
 * in an SQLite database. When connectivity is restored, queued items are
 * uploaded to Supabase Storage and processed.
 */

import * as SQLite from 'expo-sqlite';
import { File, Directory, Paths } from 'expo-file-system';
import { supabase } from '../lib/supabase';

// ── Types ───────────────────────────────────────────────────

export type QueueItemStatus = 'pending' | 'uploading' | 'failed';

export interface QueueItem {
  id: number;
  localUri: string;
  groupId: string;
  paidBy: string;
  tripId: string | null;
  status: QueueItemStatus;
  retryCount: number;
  createdAt: string;
}

// ── Database setup ──────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('billsplit_queue');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS upload_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_uri TEXT NOT NULL,
      group_id TEXT NOT NULL,
      paid_by TEXT NOT NULL,
      trip_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

// ── Queue operations ────────────────────────────────────────

/** Add a captured photo to the offline queue. */
export async function enqueue(params: {
  localUri: string;
  groupId: string;
  paidBy: string;
  tripId?: string | null;
}): Promise<number> {
  const database = await getDb();

  // Copy file to app's document directory so it persists
  const fileName = `queue_${Date.now()}.jpg`;
  const source = new File(params.localUri);
  const dest = new File(Paths.document, fileName);
  source.copy(dest);
  const destUri = dest.uri;

  const result = await database.runAsync(
    `INSERT INTO upload_queue (local_uri, group_id, paid_by, trip_id) VALUES (?, ?, ?, ?)`,
    destUri,
    params.groupId,
    params.paidBy,
    params.tripId ?? null,
  );

  return result.lastInsertRowId;
}

/** Get all pending/failed items in the queue. */
export async function getPendingItems(): Promise<QueueItem[]> {
  const database = await getDb();

  const rows = await database.getAllAsync<{
    id: number;
    local_uri: string;
    group_id: string;
    paid_by: string;
    trip_id: string | null;
    status: string;
    retry_count: number;
    created_at: string;
  }>(`SELECT * FROM upload_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`);

  return rows.map((row) => ({
    id: row.id,
    localUri: row.local_uri,
    groupId: row.group_id,
    paidBy: row.paid_by,
    tripId: row.trip_id,
    status: row.status as QueueItemStatus,
    retryCount: row.retry_count,
    createdAt: row.created_at,
  }));
}

/** Get the count of pending items in the queue. */
export async function getPendingCount(): Promise<number> {
  const database = await getDb();
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM upload_queue WHERE status IN ('pending', 'failed')`,
  );
  return result?.count ?? 0;
}

/** Mark an item as uploading. */
async function markUploading(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `UPDATE upload_queue SET status = 'uploading' WHERE id = ?`,
    id,
  );
}

/** Mark an item as failed and increment retry count. */
async function markFailed(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `UPDATE upload_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id = ?`,
    id,
  );
}

/** Remove an item from the queue after successful upload and clean up the local file. */
async function removeItem(id: number, localUri: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM upload_queue WHERE id = ?`, id);

  // Clean up the local file
  try {
    const file = new File(localUri);
    if (file.exists) {
      file.delete();
    }
  } catch (err) {
    console.error('OfflineQueue: Failed to clean up local file:', err);
  }
}

// ── Sync ────────────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Process all pending queue items. Call this when connectivity is restored.
 *
 * @param uploadFn - The function that handles a single upload (provided by receipts service).
 *                   Returns the receipt_id on success.
 */
export async function processQueue(
  uploadFn: (item: QueueItem) => Promise<string>,
): Promise<{ processed: number; failed: number }> {
  const items = await getPendingItems();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRIES) {
      // Exceeded max retries — leave as failed for user to manually retry
      failed++;
      continue;
    }

    try {
      await markUploading(item.id);
      await uploadFn(item);
      await removeItem(item.id, item.localUri);
      processed++;
    } catch (err) {
      console.error('OfflineQueue: Failed to process queue item:', err);
      await markFailed(item.id);
      failed++;
    }
  }

  return { processed, failed };
}

/** Remove all items from the queue (e.g. on user sign-out). */
export async function clearQueue(): Promise<void> {
  const database = await getDb();

  // Clean up local files first
  const items = await database.getAllAsync<{ local_uri: string }>(
    `SELECT local_uri FROM upload_queue`,
  );
  for (const item of items) {
    try {
      const file = new File(item.local_uri);
      if (file.exists) file.delete();
    } catch (err) {
      console.error('OfflineQueue: Failed to clean up file during queue clear:', err);
    }
  }

  await database.runAsync(`DELETE FROM upload_queue`);
}
