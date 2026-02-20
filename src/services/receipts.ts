/**
 * Receipt service — handles upload, processing invocation, and realtime status.
 *
 * Flow: capture photo -> upload to Supabase Storage -> create receipt DB record
 *       -> invoke process-receipt edge function -> subscribe to status via Realtime.
 */

import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type {
  Receipt,
  ReceiptWithItems,
  ReceiptProcessingStatus,
} from '../types/database';
import type { QueueItem } from './offline-queue';

// ── Types ───────────────────────────────────────────────────

export interface UploadReceiptParams {
  /** Local file URI of the captured photo. */
  localUri: string;
  /** Group this receipt belongs to. */
  groupId: string;
  /** group_members.id of the person who paid. */
  paidBy: string;
  /** Optional trip within the group. */
  tripId?: string | null;
  /** Callback for upload progress (0-1). */
  onProgress?: (progress: number) => void;
}

export interface ReceiptStatusCallback {
  (status: ReceiptProcessingStatus, receipt: Receipt): void;
}

// ── Upload ──────────────────────────────────────────────────

/**
 * Generate a unique storage path for a receipt image.
 * Format: {group_id}/{receipt_id}.jpg
 */
function storagePath(groupId: string, receiptId: string): string {
  return `${groupId}/${receiptId}.jpg`;
}

/**
 * Upload a receipt image and create the DB record + trigger processing.
 * Returns the created receipt ID.
 */
export async function uploadReceipt(params: UploadReceiptParams): Promise<string> {
  const { localUri, groupId, paidBy, tripId, onProgress } = params;

  // 1. Create receipt record in DB with pending status.
  //    We create it first so we have the ID for the storage path.
  const { data: receipt, error: insertError } = await supabase
    .from('receipts')
    .insert({
      group_id: groupId,
      paid_by: paidBy,
      trip_id: tripId ?? null,
      processing_status: 'pending',
      subtotal: 0,
      tax: 0,
      tip: 0,
      service_fee: 0,
      total: 0,
    })
    .select('id')
    .single();

  if (insertError || !receipt) {
    throw new Error(`Failed to create receipt record: ${insertError?.message ?? 'unknown error'}`);
  }

  const receiptId = receipt.id as string;
  const path = storagePath(groupId, receiptId);

  onProgress?.(0.1);

  // 2. Read the image file as an ArrayBuffer.
  const file = new File(localUri);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  onProgress?.(0.3);

  // 3. Upload to Supabase Storage.
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    // Clean up the DB record on upload failure
    await supabase.from('receipts').delete().eq('id', receiptId);
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  onProgress?.(0.6);

  // 4. Update receipt record with image_url.
  const { error: updateError } = await supabase
    .from('receipts')
    .update({ image_url: path })
    .eq('id', receiptId);

  if (updateError) {
    throw new Error(`Failed to update receipt with image URL: ${updateError.message}`);
  }

  onProgress?.(0.7);

  // 5. Invoke the process-receipt edge function.
  const { error: fnError } = await supabase.functions.invoke('process-receipt', {
    body: { receipt_id: receiptId, image_url: path },
  });

  if (fnError) {
    // Non-fatal: receipt exists and can be retried. Mark as failed.
    await supabase
      .from('receipts')
      .update({ processing_status: 'failed' as ReceiptProcessingStatus })
      .eq('id', receiptId);
    console.warn(`Edge function invocation failed for ${receiptId}:`, fnError.message);
  }

  onProgress?.(1.0);

  return receiptId;
}

/**
 * Upload a receipt from the offline queue.
 * Adapts the QueueItem shape to the standard upload params.
 */
export async function uploadFromQueue(item: QueueItem): Promise<string> {
  return uploadReceipt({
    localUri: item.localUri,
    groupId: item.groupId,
    paidBy: item.paidBy,
    tripId: item.tripId,
  });
}

// ── Realtime subscription ───────────────────────────────────

/**
 * Subscribe to processing status changes for a specific receipt.
 * Returns an unsubscribe function.
 */
export function subscribeToReceiptStatus(
  receiptId: string,
  callback: ReceiptStatusCallback,
): () => void {
  const channel = supabase
    .channel(`receipt:${receiptId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'receipts',
        filter: `id=eq.${receiptId}`,
      },
      (payload) => {
        const updated = payload.new as Receipt;
        callback(updated.processing_status, updated);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Fetching ────────────────────────────────────────────────

/** Fetch a single receipt by ID. */
export async function getReceipt(receiptId: string): Promise<Receipt> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch receipt: ${error?.message ?? 'not found'}`);
  }

  return data as Receipt;
}

/** Fetch a receipt with its line items and claims. */
export async function getReceiptWithItems(receiptId: string): Promise<ReceiptWithItems> {
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      *,
      line_items (
        *,
        claims:line_item_claims (*)
      )
    `)
    .eq('id', receiptId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch receipt with items: ${error?.message ?? 'not found'}`);
  }

  return data as unknown as ReceiptWithItems;
}

/** Fetch all receipts for a group, ordered by newest first. */
export async function getGroupReceipts(groupId: string): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch group receipts: ${error.message}`);
  }

  return (data ?? []) as Receipt[];
}

/** Get a signed URL for a receipt image. */
export async function getReceiptImageUrl(imagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(imagePath, 3600); // 1 hour expiry

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to get image URL: ${error?.message ?? 'unknown error'}`);
  }

  return data.signedUrl;
}

/** Retry processing a failed receipt. */
export async function retryProcessing(receiptId: string): Promise<void> {
  const receipt = await getReceipt(receiptId);

  if (!receipt.image_url) {
    throw new Error('Receipt has no image URL — cannot retry processing.');
  }

  await supabase
    .from('receipts')
    .update({ processing_status: 'pending' as ReceiptProcessingStatus })
    .eq('id', receiptId);

  const { error } = await supabase.functions.invoke('process-receipt', {
    body: { receipt_id: receiptId, image_url: receipt.image_url },
  });

  if (error) {
    throw new Error(`Failed to retry processing: ${error.message}`);
  }
}

/**
 * Confirm a receipt's extracted total. Called by the payer after reviewing
 * the validation screen. This signals that claiming can begin.
 */
export async function confirmReceiptTotal(
  receiptId: string,
  confirmedTotal: number,
): Promise<void> {
  const { error } = await supabase
    .from('receipts')
    .update({
      total: confirmedTotal,
      description: 'validated',
    })
    .eq('id', receiptId);

  if (error) {
    throw new Error(`Failed to confirm receipt total: ${error.message}`);
  }
}
