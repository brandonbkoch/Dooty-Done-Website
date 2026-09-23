import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const SQUARE_WEBHOOK_SIGNATURE_KEY =
  process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

const SQUARE_WEBHOOK_NOTIFICATION_URL =
  process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

function verifySquareSignature(
  signature: string,
  rawBody: string
): boolean {
  if (
    !SQUARE_WEBHOOK_SIGNATURE_KEY ||
    !SQUARE_WEBHOOK_NOTIFICATION_URL
  ) {
    return false;
  }

  const payload =
    SQUARE_WEBHOOK_NOTIFICATION_URL + rawBody;

  const expectedSignature = crypto
    .createHmac(
      "sha256",
      SQUARE_WEBHOOK_SIGNATURE_KEY
    )
    .update(payload)
    .digest("base64");

  const receivedBuffer = Buffer.from(
    signature,
    "utf8"
  );

  const expectedBuffer = Buffer.from(
    expectedSignature,
    "utf8"
  );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    // ---------------------------------------------------------
    // 1. Verify required environment variables
    // ---------------------------------------------------------

    if (
      !SUPABASE_URL ||
      !SUPABASE_SECRET_KEY
    ) {
      console.error(
        "Missing Supabase server environment variables."
      );

      return jsonError(
        "Webhook server configuration is incomplete.",
        500
      );
    }

    if (
      !SQUARE_WEBHOOK_SIGNATURE_KEY ||
      !SQUARE_WEBHOOK_NOTIFICATION_URL
    ) {
      console.error(
        "Missing Square webhook environment variables."
      );

      return jsonError(
        "Square webhook configuration is incomplete.",
        500
      );
    }

    // ---------------------------------------------------------
    // Create Supabase admin client ONLY when the webhook runs.
    //
    // This prevents Next.js build-time evaluation from trying
    // to initialize Supabase without the local secret key.
    // ---------------------------------------------------------

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // ---------------------------------------------------------
    // 2. Read raw request body
    // ---------------------------------------------------------

    const rawBody = await request.text();

    if (!rawBody) {
      return jsonError(
        "Empty webhook body."
      );
    }

    // ---------------------------------------------------------
    // 3. Verify Square signature
    // ---------------------------------------------------------

    const signature = request.headers.get(
      "x-square-hmacsha256-signature"
    );

    if (!signature) {
      console.error(
        "Square webhook rejected: missing signature."
      );

      return jsonError(
        "Missing Square webhook signature.",
        401
      );
    }

    const validSignature =
      verifySquareSignature(
        signature,
        rawBody
      );

    if (!validSignature) {
      console.error(
        "Square webhook rejected: invalid signature."
      );

      return jsonError(
        "Invalid Square webhook signature.",
        401
      );
    }

    // ---------------------------------------------------------
    // 4. Parse Square event
    // ---------------------------------------------------------

    let event: any;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonError(
        "Invalid webhook JSON."
      );
    }

    console.log(
      "Square webhook received:",
      event?.type,
      event?.event_id
    );

    // ---------------------------------------------------------
    // 5. Ignore events we don't need
    // ---------------------------------------------------------

    if (
      event?.type !== "payment.updated" &&
      event?.type !== "payment.created"
    ) {
      return NextResponse.json({
        success: true,
        ignored: true,
        eventType:
          event?.type || null,
      });
    }

    // ---------------------------------------------------------
    // 6. Get Payment object
    // ---------------------------------------------------------

    const payment =
      event?.data?.object?.payment;

    if (!payment?.id) {
      console.error(
        "Square webhook did not contain a payment ID."
      );

      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "No payment object.",
      });
    }

    const squarePaymentId =
      payment.id;

    // ---------------------------------------------------------
    // 7. Only process completed payments
    // ---------------------------------------------------------

    if (
      payment.status !== "COMPLETED"
    ) {
      console.log(
        `Square payment ${squarePaymentId} is ${payment.status}; waiting for completion.`
      );

      return NextResponse.json({
        success: true,
        ignored: true,
        paymentStatus:
          payment.status,
      });
    }

    // ---------------------------------------------------------
    // 8. Prevent duplicate payment records
    // ---------------------------------------------------------

    const {
      data: existingPayment,
      error: existingPaymentError,
    } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq(
        "square_payment_id",
        squarePaymentId
      )
      .maybeSingle();

    if (existingPaymentError) {
      console.error(
        "Error checking existing payment:",
        existingPaymentError
      );

      return jsonError(
        "Could not check existing payment.",
        500
      );
    }

    if (existingPayment) {
      console.log(
        `Payment ${squarePaymentId} already exists in Dooty Done.`
      );

      return NextResponse.json({
        success: true,
        alreadyRecorded: true,
        paymentId:
          existingPayment.id,
      });
    }

    // ---------------------------------------------------------
    // 9. Get Square order ID
    // ---------------------------------------------------------

    const squareOrderId =
      payment.order_id || null;

    if (!squareOrderId) {
      console.error(
        `Payment ${squarePaymentId} has no Square order ID.`
      );

      return jsonError(
        "Completed Square payment has no order ID.",
        400
      );
    }

    // ---------------------------------------------------------
    // 10. Find matching Dooty Done payment link
    // ---------------------------------------------------------

    const {
      data: paymentLink,
      error: paymentLinkError,
    } = await supabaseAdmin
      .from("payment_links")
      .select(
        `
        id,
        customer_id,
        customer_service_id,
        appointment_id,
        job_id,
        amount,
        name,
        description,
        payment_note,
        square_payment_link_id,
        square_order_id,
        status
        `
      )
      .eq(
        "square_order_id",
        squareOrderId
      )
      .maybeSingle();

    if (paymentLinkError) {
      console.error(
        "Error finding payment link:",
        paymentLinkError
      );

      return jsonError(
        "Could not find the Dooty Done payment link.",
        500
      );
    }

    if (!paymentLink) {
      console.error(
        `No Dooty Done payment link found for Square order ${squareOrderId}.`
      );

      return jsonError(
        "No matching Dooty Done payment link found.",
        404
      );
    }

    // ---------------------------------------------------------
    // 11. Get actual Square payment amount
    // ---------------------------------------------------------

    const amountCents =
      payment?.amount_money?.amount;

    if (
      amountCents === undefined ||
      amountCents === null
    ) {
      return jsonError(
        "Square payment did not include an amount.",
        400
      );
    }

    const amount =
      Number(amountCents) / 100;

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return jsonError(
        "Square payment amount is invalid.",
        400
      );
    }

    // ---------------------------------------------------------
    // 12. Create Dooty Done payment record
    // ---------------------------------------------------------

    const paymentNotes = [
      `Payment link: ${paymentLink.name}`,
      `Square order: ${squareOrderId}`,
      `Square payment: ${squarePaymentId}`,
    ];

    if (paymentLink.description) {
      paymentNotes.push(
        `Description: ${paymentLink.description}`
      );
    }

    const {
      data: insertedPayment,
      error: insertError,
    } = await supabaseAdmin
      .from("payments")
      .insert({
        customer_id:
          paymentLink.customer_id,

        customer_service_id:
          paymentLink.customer_service_id,

        appointment_id:
          paymentLink.appointment_id,

        amount,

        status: "paid",

        payment_method:
          "square_payment_link",

        paid_at:
          payment.completed_at ||
          new Date().toISOString(),

        square_payment_id:
          squarePaymentId,

        receipt_url:
          payment.receipt_url ||
          null,

        job_id:
          paymentLink.job_id,

        notes:
          paymentNotes.join(
            " | "
          ),
      })
      .select(
        `
        id,
        customer_id,
        amount,
        status,
        payment_method,
        square_payment_id,
        job_id
        `
      )
      .single();

    if (insertError) {
      console.error(
        "Failed to create Dooty Done payment:",
        insertError
      );

      return jsonError(
        "Square payment succeeded, but Dooty Done could not create the payment record.",
        500
      );
    }

    // ---------------------------------------------------------
    // 13. Mark payment link as paid
    // ---------------------------------------------------------

    const {
      error: updateLinkError,
    } = await supabaseAdmin
      .from("payment_links")
      .update({
        status: "paid",

        square_payment_id:
          squarePaymentId,

        paid_at:
          payment.completed_at ||
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        paymentLink.id
      );

    if (updateLinkError) {
      console.error(
        "Payment was recorded, but payment link could not be updated:",
        updateLinkError
      );

      return NextResponse.json({
        success: true,
        paymentRecorded: true,
        paymentId:
          insertedPayment.id,
        paymentLinkUpdated: false,
        warning:
          "Payment recorded successfully, but the payment-link status could not be updated.",
      });
    }

    // ---------------------------------------------------------
    // 14. Success
    // ---------------------------------------------------------

    console.log(
      `Dooty Done payment ${insertedPayment.id} created from Square payment ${squarePaymentId}.`
    );

    return NextResponse.json({
      success: true,

      paymentRecorded: true,

      payment:
        insertedPayment,

      paymentLink: {
        id: paymentLink.id,
        status: "paid",
        squarePaymentId,
        squareOrderId,
      },
    });
  } catch (error) {
    console.error(
      "Square webhook error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected webhook server error.",
      },
      { status: 500 }
    );
  }
}