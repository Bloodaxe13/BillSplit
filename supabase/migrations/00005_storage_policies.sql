-- =============================================================================
-- BillSplit: Storage Policies
-- Migration: 00005_storage_policies.sql
--
-- RLS policies for the receipts storage bucket.
-- =============================================================================

-- Ensure the bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('receipts', 'receipts', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Group members can view receipt images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Receipt owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts');
