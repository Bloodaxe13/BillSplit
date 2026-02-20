/**
 * send-notification — Supabase Edge Function
 *
 * Accepts a list of recipient user IDs and a notification payload,
 * resolves their Expo push tokens from the profiles table, and
 * sends push notifications via the Expo Push API.
 *
 * Expected POST body:
 * {
 *   "recipient_user_ids": ["uuid1", "uuid2"],
 *   "title": "New Receipt",
 *   "body": "Dan added a receipt from Warung Bali",
 *   "data": { "type": "receipt_added", "receipt_id": "..." }
 * }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabase-client.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendNotificationPayload {
  recipient_user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data?: Record<string, string>;
}

interface ExpoPushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo Push API accepts up to 100 messages per request. */
const EXPO_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch push tokens for the given user IDs from the profiles table. */
async function getTokensForUsers(
  userIds: string[],
): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("push_token")
    .in("id", userIds)
    .not("push_token", "is", null);

  if (error) {
    console.error("Failed to fetch push tokens:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row.push_token as string)
    .filter((token) => token.startsWith("ExponentPushToken["));
}

/** Send a batch of messages to the Expo Push API. */
async function sendExpoPushBatch(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Expo Push API error (${res.status}): ${errorText}`);
  }

  const result = await res.json();
  return result.data as ExpoPushTicket[];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: SendNotificationPayload;
  try {
    payload = (await req.json()) as SendNotificationPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { recipient_user_ids, title, body, data } = payload;

  if (!recipient_user_ids?.length || !title || !body) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: recipient_user_ids, title, body",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(
    `Sending notification to ${recipient_user_ids.length} user(s): "${title}"`,
  );

  // Resolve push tokens
  const tokens = await getTokensForUsers(recipient_user_ids);

  if (tokens.length === 0) {
    console.log("No valid push tokens found — skipping send.");
    return new Response(
      JSON.stringify({ success: true, sent: 0, reason: "no_tokens" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Build messages
  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: "default" as const,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  }));

  // Send in batches
  const allTickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    const tickets = await sendExpoPushBatch(batch);
    allTickets.push(...tickets);
  }

  // Log any errors
  const errors = allTickets.filter((t) => t.status === "error");
  if (errors.length > 0) {
    console.error(
      `${errors.length} push notification(s) failed:`,
      errors.map((e) => e.details?.error ?? e.message),
    );
  }

  const sent = allTickets.filter((t) => t.status === "ok").length;
  console.log(
    `Notification sent: ${sent}/${tokens.length} delivered, ${errors.length} failed`,
  );

  return new Response(
    JSON.stringify({
      success: true,
      sent,
      failed: errors.length,
      total_tokens: tokens.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
