import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const ADMIN_EMAIL = "contact.dootydone@gmail.com";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // 1. Verify admin authentication
    // ---------------------------------------------------------

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonError("Missing authorization token.", 401);
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    if (!accessToken) {
      return jsonError("Missing access token.", 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonError("Invalid authentication.", 401);
    }

    if (user.email !== ADMIN_EMAIL) {
      return jsonError("Unauthorized.", 403);
    }

    // ---------------------------------------------------------
    // 2. Environment validation
    // ---------------------------------------------------------

    if (
      !SQUARE_ACCESS_TOKEN ||
      !SQUARE_LOCATION_ID ||
      !SUPABASE_URL ||
      !SUPABASE_PUBLISHABLE_KEY
    ) {
      return jsonError(
        "Required Square or Supabase environment variables are missing.",
        500
      );
    }

    // ---------------------------------------------------------
    // 3. Read request body
    // ---------------------------------------------------------

    const body = await request.json();

    const amount = Number(body.amount);
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const paymentNote = String(body.paymentNote || "").trim();

    const customerId =
      body.customerId === null ||
      body.customerId === undefined ||
      body.customerId === ""
        ? null
        : Number(body.customerId);

    const customerServiceId =
      body.customerServiceId === null ||
      body.customerServiceId === undefined ||
      body.customerServiceId === ""
        ? null
        : Number(body.customerServiceId);

    const appointmentId =
      body.appointmentId === null ||
      body.appointmentId === undefined ||
      body.appointmentId === ""
        ? null
        : Number(body.appointmentId);

    const jobId =
      body.jobId === null ||
      body.jobId === undefined ||
      body.jobId === ""
        ? null
        : Number(body.jobId);

    // ---------------------------------------------------------
    // 4. Validate input
    // ---------------------------------------------------------

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError("Amount must be greater than $0.");
    }

    if (!name) {
      return jsonError("Payment name is required.");
    }

    if (customerId !== null && !Number.isInteger(customerId)) {
      return jsonError("Invalid customer ID.");
    }

    if (
      customerServiceId !== null &&
      !Number.isInteger(customerServiceId)
    ) {
      return jsonError("Invalid customer service ID.");
    }

    if (appointmentId !== null && !Number.isInteger(appointmentId)) {
      return jsonError("Invalid appointment ID.");
    }

    if (jobId !== null && !Number.isInteger(jobId)) {
      return jsonError("Invalid job ID.");
    }

    // ---------------------------------------------------------
    // 5. Load customer information if supplied
    // ---------------------------------------------------------

    let customer:
      | {
          id: number;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }
      | null = null;

    if (customerId !== null) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone")
        .eq("id", customerId)
        .single();

      if (error || !data) {
        return jsonError("Customer not found.");
      }

      customer = data;
    }

    // ---------------------------------------------------------
    // 6. Create Square payment link
    // ---------------------------------------------------------

    const idempotencyKey = crypto.randomUUID();

    const squareResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Square-Version": "2026-09-16",
        },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,

          quick_pay: {
            name,
            price_money: {
              amount: Math.round(amount * 100),
              currency: "USD",
            },
            location_id: SQUARE_LOCATION_ID,
          },

          description: description || undefined,

          payment_note: paymentNote || undefined,

          checkout_options: {
            ask_for_shipping_address: false,
            allow_tipping: false,
          },

          ...(customer
            ? {
                pre_populated_data: {
                  buyer_email: customer.email || undefined,
                  buyer_phone_number: customer.phone || undefined,
                },
              }
            : {}),
        }),
      }
    );

    const squareData = await squareResponse.json();

    if (!squareResponse.ok) {
      console.error(
        "Square payment link creation failed:",
        JSON.stringify(squareData, null, 2)
      );

      const squareMessage =
        squareData?.errors?.[0]?.detail ||
        "Square could not create the payment link.";

      return jsonError(squareMessage, squareResponse.status);
    }

    const paymentLink = squareData?.payment_link;

    if (!paymentLink?.id) {
      console.error(
        "Square response did not include payment_link:",
        JSON.stringify(squareData, null, 2)
      );

      return jsonError(
        "Square created an unexpected response without a payment link.",
        500
      );
    }

    // ---------------------------------------------------------
    // 7. Save payment link in Dooty Done
    // ---------------------------------------------------------

    const amountForDatabase = amount.toFixed(2);

    const { error: insertError } = await supabase
      .from("payment_links")
      .insert({
        customer_id: customerId,
        customer_service_id: customerServiceId,
        appointment_id: appointmentId,
        job_id: jobId,

        amount: amountForDatabase,

        name,
        description: description || null,
        payment_note: paymentNote || null,

        square_payment_link_id: paymentLink.id,
        square_order_id: paymentLink.order_id || null,
        square_url: paymentLink.url || null,
        square_long_url: paymentLink.long_url || null,

        status: "created",
      });

    if (insertError) {
      console.error(
        "Payment link was created in Square but could not be saved in Supabase:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Square created the payment link, but Dooty Done could not save the payment-link record.",
          squarePaymentLinkCreated: true,
          paymentLinkId: paymentLink.id,
          paymentLinkUrl:
            paymentLink.url || paymentLink.long_url || null,
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 8. Return success
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,

      paymentLink: {
        id: paymentLink.id,
        url: paymentLink.url || null,
        longUrl: paymentLink.long_url || null,
        orderId: paymentLink.order_id || null,

        amount,

        name,
        description,
        customerId,

        createdAt: paymentLink.created_at || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Payment link route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}