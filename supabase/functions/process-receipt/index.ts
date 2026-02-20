/**
 * process-receipt — Supabase Edge Function
 *
 * Triggered when a receipt image is uploaded. Runs the hybrid OCR + LLM
 * pipeline:
 *
 *   1. Mark receipt as "processing"
 *   2. Fetch image bytes from Supabase Storage (or public URL)
 *   3. Send image to Google Document AI for OCR
 *   4. Pipe OCR text to OpenAI GPT-5.2 to structure into clean JSON
 *   5. Write structured line items + metadata back to the database
 *   6. Mark receipt as "completed" (or "failed" on error)
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabase-client.ts";
import type {
  DocumentAIRequest,
  DocumentAIResponse,
  LineItemInsert,
  ProcessReceiptPayload,
  StructuredReceipt,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Constants & config
// ---------------------------------------------------------------------------

const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

// Document AI processor coordinates — override via env if needed.
const DOC_AI_PROJECT = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID") ?? "";
const DOC_AI_LOCATION = Deno.env.get("GOOGLE_CLOUD_LOCATION") ?? "us";
const DOC_AI_PROCESSOR = Deno.env.get("GOOGLE_CLOUD_PROCESSOR_ID") ?? "";

const DOCUMENT_AI_URL =
  `https://documentai.googleapis.com/v1/projects/${DOC_AI_PROJECT}/locations/${DOC_AI_LOCATION}/processors/${DOC_AI_PROCESSOR}:process`;

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-5.2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a Supabase Storage path or signed URL to raw bytes + mime type. */
async function fetchImageBytes(
  imageUrl: string,
): Promise<{ base64: string; mimeType: string }> {
  const supabase = getSupabaseAdmin();

  // If the URL is a storage object path (not a full URL), generate a signed URL.
  let resolvedUrl = imageUrl;
  if (!imageUrl.startsWith("http")) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(imageUrl, 300); // 5-minute expiry
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL for ${imageUrl}: ${error?.message}`);
    }
    resolvedUrl = data.signedUrl;
  }

  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status}): ${resolvedUrl}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
  );

  return { base64, mimeType: contentType };
}

/** Call Google Document AI to OCR the receipt image. */
async function runDocumentAI(
  base64Image: string,
  mimeType: string,
): Promise<{ fullText: string; rawResponse: DocumentAIResponse }> {
  const body: DocumentAIRequest = {
    rawDocument: {
      content: base64Image,
      mimeType,
    },
  };

  const res = await fetch(`${DOCUMENT_AI_URL}?key=${GOOGLE_CLOUD_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Document AI request failed (${res.status}): ${errorText}`);
  }

  const data: DocumentAIResponse = await res.json();
  const fullText = data.document?.text ?? "";

  if (!fullText.trim()) {
    throw new Error("Document AI returned empty text — the image may be unreadable.");
  }

  return { fullText, rawResponse: data };
}

/** Call OpenAI GPT-5.2 to structure the raw OCR text into clean JSON. */
async function structureWithGPT(ocrText: string): Promise<StructuredReceipt> {
  const systemPrompt = `You are a receipt-parsing assistant for a travel expense splitting app called BillSplit.

You will receive raw OCR text extracted from a receipt image. Your job is to parse it into structured JSON.

RULES:
- Extract every line item with its description, quantity, unit price, and total price.
- Normalize item descriptions: fix OCR typos, expand abbreviations, use title case (e.g. "nsi grg 2x" -> "Nasi Goreng").
- Identify the currency from context (symbols, country cues, vendor name). Output the ISO 4217 code.
- ALL monetary values must be integers in the smallest currency unit (cents for USD, sen for IDR, pence for GBP, etc.). For example, $12.50 = 1250, Rp 45.000 = 4500000 (note: Indonesian pricing uses periods as thousands separators).
- Identify the tax structure:
  - Flat tax on subtotal (common in US)
  - Service fee on subtotal, then tax on subtotal + service fee (common in Southeast Asia)
  - VAT inclusive in listed prices (common in Europe/Australia)
  - Any other pattern you detect
- Assign each item a category: "food", "drink", or "other".
- If tip is present, extract it. If not, set to 0.
- If service fee is present, extract it. If not, set to 0.
- The total should match the receipt total. If line items don't perfectly sum to the subtotal, use the receipt's printed subtotal.

OUTPUT FORMAT (strict JSON, no markdown fences, no commentary):
{
  "vendor_name": "string",
  "currency": "string (ISO 4217)",
  "line_items": [
    {
      "description": "string",
      "quantity": 1,
      "unit_price": 4500000,
      "total_price": 4500000,
      "category": "food"
    }
  ],
  "subtotal": 18000000,
  "tax": 1800000,
  "tip": 0,
  "service_fee": 1260000,
  "total": 21060000,
  "tax_structure": {
    "service_fee": { "rate": 0.07, "base": "subtotal" },
    "tax": { "rate": 0.10, "base": "subtotal_plus_service_fee" }
  }
}

If you cannot determine a field with confidence, use your best estimate and never omit required fields.`;

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here is the OCR text extracted from a receipt. Parse it into structured JSON.\n\n---\n${ocrText}\n---`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${errorText}`);
  }

  const completion = await res.json();
  const content: string | undefined = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response — no choices or content.");
  }

  // Parse the JSON. GPT may occasionally wrap in markdown fences despite
  // the response_format hint, so strip them defensively.
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: StructuredReceipt;
  try {
    parsed = JSON.parse(cleaned) as StructuredReceipt;
  } catch (e) {
    throw new Error(`Failed to parse GPT output as JSON: ${(e as Error).message}\nRaw: ${cleaned}`);
  }

  // Basic validation
  if (!parsed.line_items || !Array.isArray(parsed.line_items) || parsed.line_items.length === 0) {
    throw new Error("GPT output contained no line items — extraction likely failed.");
  }
  if (typeof parsed.total !== "number" || parsed.total <= 0) {
    throw new Error(`GPT output has invalid total: ${parsed.total}`);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/** Set the receipt's processing_status (and optionally stash error info). */
async function updateReceiptStatus(
  receiptId: string,
  status: "processing" | "completed" | "failed",
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const update: Record<string, unknown> = { processing_status: status, ...extra };

  const { error } = await supabase.from("receipts").update(update).eq("id", receiptId);

  if (error) {
    console.error(`Failed to update receipt ${receiptId} to ${status}:`, error.message);
    // Don't throw here — we don't want a status-update failure to mask the
    // original error when we're already in the "failed" path.
  }
}

/** Write the structured receipt data and line items to the database. */
async function writeResults(
  receiptId: string,
  structured: StructuredReceipt,
  ocrRaw: unknown,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 1. Update the receipt row with extracted metadata.
  const { error: receiptError } = await supabase
    .from("receipts")
    .update({
      vendor_name: structured.vendor_name,
      currency: structured.currency,
      subtotal: structured.subtotal,
      tax: structured.tax,
      tip: structured.tip,
      service_fee: structured.service_fee,
      total: structured.total,
      tax_structure: structured.tax_structure,
      ocr_raw: ocrRaw,
      processing_status: "completed",
    })
    .eq("id", receiptId);

  if (receiptError) {
    throw new Error(`Failed to update receipt row: ${receiptError.message}`);
  }

  // 2. Insert line items.
  const lineItems: LineItemInsert[] = structured.line_items.map((item) => ({
    receipt_id: receiptId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category: item.category,
  }));

  const { error: lineItemsError } = await supabase.from("line_items").insert(lineItems);

  if (lineItemsError) {
    throw new Error(`Failed to insert line items: ${lineItemsError.message}`);
  }

  console.log(
    `Receipt ${receiptId}: wrote ${lineItems.length} line items, total=${structured.total} ${structured.currency}`,
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  // Only accept POST.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: ProcessReceiptPayload;
  try {
    payload = (await req.json()) as ProcessReceiptPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { receipt_id, image_url } = payload;

  if (!receipt_id || !image_url) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: receipt_id, image_url" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(`Processing receipt ${receipt_id} — image: ${image_url}`);

  // Step 1: Mark as processing.
  await updateReceiptStatus(receipt_id, "processing");

  try {
    // Step 2: Fetch the image bytes.
    console.log(`Receipt ${receipt_id}: fetching image...`);
    const { base64, mimeType } = await fetchImageBytes(image_url);
    console.log(
      `Receipt ${receipt_id}: image fetched (${Math.round(base64.length * 0.75 / 1024)} KB, ${mimeType})`,
    );

    // Step 3: OCR via Google Document AI.
    console.log(`Receipt ${receipt_id}: running Document AI OCR...`);
    const { fullText, rawResponse } = await runDocumentAI(base64, mimeType);
    console.log(
      `Receipt ${receipt_id}: OCR complete — ${fullText.length} chars extracted`,
    );

    // Step 4: Structure via OpenAI GPT-5.2.
    console.log(`Receipt ${receipt_id}: structuring with GPT-5.2...`);
    const structured = await structureWithGPT(fullText);
    console.log(
      `Receipt ${receipt_id}: structured — ${structured.line_items.length} items, ` +
        `total=${structured.total} ${structured.currency}, vendor="${structured.vendor_name}"`,
    );

    // Step 5: Write results to database (receipt metadata + line items).
    console.log(`Receipt ${receipt_id}: writing results to database...`);
    await writeResults(receipt_id, structured, {
      document_ai: rawResponse,
      ocr_text: fullText,
    });

    console.log(`Receipt ${receipt_id}: processing complete.`);

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id,
        vendor_name: structured.vendor_name,
        currency: structured.currency,
        line_item_count: structured.line_items.length,
        total: structured.total,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Receipt ${receipt_id}: processing FAILED — ${message}`);

    // Step 6 (error path): Mark as failed, stash error in ocr_raw for debugging.
    await updateReceiptStatus(receipt_id, "failed", {
      ocr_raw: { error: message, failed_at: new Date().toISOString() },
    });

    return new Response(
      JSON.stringify({ success: false, receipt_id, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
