import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface OpenExchangeRatesResponse {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string;
  rates: Record<string, number>;
}

serve(async (req: Request): Promise<Response> => {
  try {
    // Only allow POST (cron/manual trigger) or OPTIONS (CORS preflight)
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch exchange rates from Open Exchange Rates API
    const appId = Deno.env.get("OPEN_EXCHANGE_RATES_APP_ID");
    if (!appId) {
      throw new Error(
        "Missing environment variable: OPEN_EXCHANGE_RATES_APP_ID"
      );
    }

    const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${appId}`;
    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `Open Exchange Rates API error (${apiResponse.status}): ${errorText}`
      );
    }

    const data: OpenExchangeRatesResponse = await apiResponse.json();

    // Validate response structure
    if (!data.base || !data.rates || typeof data.rates !== "object") {
      throw new Error("Invalid response structure from Open Exchange Rates API");
    }

    // Initialize Supabase client with service role key for DB writes
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        "Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const fetchedAt = new Date(data.timestamp * 1000).toISOString();

    // Upsert into exchange_rates table.
    // The unique constraint is (base_currency, fetched_date), so we include
    // fetched_date to match. This gives us one row per base per day.
    const fetchedDate = fetchedAt.slice(0, 10); // "YYYY-MM-DD"

    const { error: upsertError } = await supabase
      .from("exchange_rates")
      .upsert(
        {
          base_currency: data.base,
          rates: data.rates,
          fetched_at: fetchedAt,
          fetched_date: fetchedDate,
        },
        { onConflict: "base_currency,fetched_date" }
      );

    if (upsertError) {
      throw new Error(`Supabase upsert error: ${upsertError.message}`);
    }

    const rateCount = Object.keys(data.rates).length;

    return new Response(
      JSON.stringify({
        success: true,
        base: data.base,
        rateCount,
        fetchedAt,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("update-exchange-rates error:", message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
