/**
 * Types for the process-receipt Edge Function.
 *
 * All monetary values are integers in the smallest currency unit
 * (e.g. cents for USD, sen for IDR) to avoid floating-point issues.
 */

// ---------------------------------------------------------------------------
// Request / invocation payload
// ---------------------------------------------------------------------------

/** Payload sent to the edge function when a receipt needs processing. */
export interface ProcessReceiptPayload {
  receipt_id: string;
  image_url: string;
}

// ---------------------------------------------------------------------------
// Google Document AI
// ---------------------------------------------------------------------------

/** Body sent to the Document AI REST endpoint. */
export interface DocumentAIRequest {
  rawDocument: {
    content: string; // base64-encoded image
    mimeType: string;
  };
}

/** Simplified shape of the Document AI response we care about. */
export interface DocumentAIResponse {
  document: {
    text: string;
    pages: DocumentAIPage[];
  };
}

export interface DocumentAIPage {
  pageNumber: number;
  tables?: DocumentAITable[];
  lines?: DocumentAILine[];
}

export interface DocumentAITable {
  headerRows: DocumentAITableRow[];
  bodyRows: DocumentAITableRow[];
}

export interface DocumentAITableRow {
  cells: DocumentAITableCell[];
}

export interface DocumentAITableCell {
  layout: {
    textAnchor: {
      textSegments: Array<{ startIndex: string; endIndex: string }>;
    };
  };
}

export interface DocumentAILine {
  layout: {
    textAnchor: {
      textSegments: Array<{ startIndex: string; endIndex: string }>;
    };
  };
}

// ---------------------------------------------------------------------------
// OpenAI GPT-5.2 structuring
// ---------------------------------------------------------------------------

/** Category assigned by the LLM to each line item. */
export type LineItemCategory = "food" | "drink" | "other";

/** A single extracted & structured line item. */
export interface StructuredLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: LineItemCategory;
}

/** Tax-structure entry describing how a fee is calculated. */
export interface TaxComponent {
  rate: number;
  base: string; // e.g. "subtotal", "subtotal_plus_service_fee"
}

/** The full structured receipt returned by GPT-5.2. */
export interface StructuredReceipt {
  vendor_name: string;
  currency: string; // ISO 4217
  line_items: StructuredLineItem[];
  subtotal: number;
  tax: number;
  tip: number;
  service_fee: number;
  total: number;
  tax_structure: Record<string, TaxComponent>;
}

// ---------------------------------------------------------------------------
// Database row shapes (subset of columns we read / write)
// ---------------------------------------------------------------------------

/** Shape of a receipt row as stored in the database. */
export interface ReceiptRow {
  id: string;
  group_id: string;
  trip_id: string | null;
  paid_by: string;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  service_fee: number | null;
  total: number | null;
  tax_structure: Record<string, TaxComponent> | null;
  image_url: string;
  ocr_raw: unknown | null;
  processing_status: "pending" | "processing" | "completed" | "failed";
  vendor_name: string | null;
  created_at: string;
}

/** Shape of a line_item row to insert. */
export interface LineItemInsert {
  receipt_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: LineItemCategory;
}
