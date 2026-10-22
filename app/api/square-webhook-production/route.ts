
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const SQUARE_WEBHOOK_PRODUCTION_SIGNATURE_KEY =
  process.env.SQUARE_WEBHOOK_PRODUCTION_SIGNATURE_KEY;

const SQUARE_WEBHOOK_PRODUCTION_NOTIFICATION_URL =
  process.env.SQUARE_WEBHOOK_PRODUCTION_NOTIFICATION_URL;

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

function verifySquareSignature(
  signature: string,
  rawBody: string
): boolean {
  if (
    !SQUARE_WEBHOOK_PRODUCTION_SIGNATURE_KEY ||
    !SQUARE_WEBHOOK_PRODUCTION_NOTIFICATION_URL
  ) {
    return false;
  }

  const payload =
    SQUARE_WEBHOOK_PRODUCTION_NOTIFICATION_URL + rawBody;

  const expectedSignature = crypto
    .createHmac(
      "sha256",
      SQUARE_WEBHOOK_PRODUCTION_SIGNATURE_KEY
    )
    .update(payload)
    .digest("base64");

  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(
    expectedSignature,
    "utf8"
  );

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

type SquareMoney = {
  amount?: number | string | null;
  currency?: string;
} | null;

type SquarePayment = {
  id?: string;
  status?: string;
  order_id?: string | null;
  amount_money?: SquareMoney;
  completed_at?: string | null;
  receipt_url?: string | null;
};

type SquareRefund = {
  id?: string;
  payment_id?: string;
  status?: string;
  amount_money?: SquareMoney;
  reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SquareWebhookEvent = {
  type?: string;
  event_id?: string;
  data?: {
    object?: {
      payment?: SquarePayment;
      refund?: SquareRefund;
    };
  };
};

function mapRefundStatus(
  squareStatus: string | undefined
): "pending" | "completed" | "failed" {
  switch ((squareStatus || "").toUpperCase()) {
    case "COMPLETED":
      return "completed";

    case "FAILED":
    case "REJECTED":
      return "failed";

    case "PENDING":
    case "APPROVED":
    default:
      return "pending";
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      console.error(
        "Missing Supabase server environment variables."
      );

      return jsonError(
        "Webhook server configuration is incomplete.",
        500
      );
    }

    if (
      !SQUARE_WEBHOOK_PRODUCTION_SIGNATURE_KEY ||
      !SQUARE_WEBHOOK_PRODUCTION_NOTIFICATION_URL
    ) {
      console.error(
        "Missing Square webhook environment variables."
      );

      return jsonError(
        "Square webhook configuration is incomplete.",
        500
      );
    }

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

    const rawBody = await request.text();

    if (!rawBody) {
      return jsonError("Empty webhook body.");
    }

    const signature = request.headers.get(
      "x-square-hmacsha256-signature"
    );

    if (!signature) {
      return jsonError(
        "Missing Square webhook signature.",
        401
      );
    }

    if (!verifySquareSignature(signature, rawBody)) {
      console.error(
        "Square webhook rejected: invalid signature."
      );

      return jsonError(
        "Invalid Square webhook signature.",
        401
      );
    }

    let event: SquareWebhookEvent;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonError("Invalid webhook JSON.");
    }

    console.log(
      "Square webhook received:",
      event.type,
      event.event_id
    );

    // ---------------------------------------------------------
    // REFUND EVENTS
    // ---------------------------------------------------------

    if (
      event.type === "refund.created" ||
      event.type === "refund.updated"
    ) {
      const refund = event.data?.object?.refund;

      if (
        !refund?.id ||
        !refund.payment_id ||
        refund.amount_money?.amount == null
      ) {
        console.error(
          "Refund webhook is missing required refund fields."
        );

        return jsonError(
          "Refund webhook is missing required fields.",
          500
        );
      }

      const refundAmountCents = Number(
        refund.amount_money.amount
      );

      if (
        !Number.isSafeInteger(refundAmountCents) ||
        refundAmountCents <= 0 ||
        (refund.amount_money.currency &&
          refund.amount_money.currency !== "USD")
      ) {
        return jsonError(
          "Refund amount or currency is invalid.",
          500
        );
      }

      // Find the original payment recorded by Dooty Done.
      const {
        data: originalPayment,
        error: originalPaymentError,
      } = await supabaseAdmin
        .from("payments")
        .select(
          "id, customer_id, job_id, amount, status, square_payment_id"
        )
        .eq("square_payment_id", refund.payment_id)
        .maybeSingle();

      if (originalPaymentError) {
        console.error(
          "Refund payment lookup failed:",
          originalPaymentError
        );

        return jsonError(
          "Could not find the original payment.",
          500
        );
      }

      // Return a retryable error if payment and refund events
      // arrive out of order. Do not create an orphan refund.
      if (!originalPayment) {
        console.error(
          "Refund arrived before its Dooty Done payment record:",
          refund.id
        );

        return jsonError(
          "Original payment is not recorded yet.",
          500
        );
      }

      const localRefundStatus = mapRefundStatus(
        refund.status
      );

      const refundTimestamp =
        refund.updated_at ||
        refund.created_at ||
        new Date().toISOString();

      // Look for an existing local refund by its stable
      // Square refund ID. Preserve its original idempotency key.
      const {
        data: existingRefund,
        error: existingRefundError,
      } = await supabaseAdmin
        .from("refunds")
        .select(
          "id, payment_id, square_idempotency_key"
        )
        .eq("square_refund_id", refund.id)
        .maybeSingle();

      if (existingRefundError) {
        console.error(
          "Refund record lookup failed:",
          existingRefundError
        );

        return jsonError(
          "Could not check the existing refund record.",
          500
        );
      }

      if (
        existingRefund &&
        existingRefund.payment_id !== originalPayment.id
      ) {
        console.error(
          "Square refund ID is already linked to another payment:",
          refund.id
        );

        return jsonError(
          "Refund is linked to a different payment.",
          500
        );
      }

      const refundValues = {
        payment_id: originalPayment.id,
        customer_id: originalPayment.customer_id,
        job_id: originalPayment.job_id,
        amount: refundAmountCents / 100,
        status: localRefundStatus,
        square_refund_id: refund.id,
        reason: refund.reason || "Square refund",
        updated_at: new Date().toISOString(),
        processed_at:
          localRefundStatus === "completed"
            ? refundTimestamp
            : null,
      };

      if (existingRefund) {
        const { error: refundUpdateError } =
          await supabaseAdmin
            .from("refunds")
            .update(refundValues)
            .eq("id", existingRefund.id);

        if (refundUpdateError) {
          console.error(
            "Refund record update failed:",
            refundUpdateError
          );

          return jsonError(
            "Could not update the refund record.",
            500
          );
        }
      } else {
        // Stable local key for refunds initiated outside
        // Dooty Done. This does not issue a Square request.
        const { error: refundInsertError } =
          await supabaseAdmin
            .from("refunds")
            .insert({
              ...refundValues,
              square_idempotency_key:
                `webhook-refund-${refund.id}`,
              created_at:
                refund.created_at ||
                new Date().toISOString(),
            });

        if (refundInsertError) {
          console.error(
            "Refund record insert failed:",
            refundInsertError
          );

          // Square can retry the event. On retry, the
          // existing Square refund ID will be checked again.
          return jsonError(
            "Could not save the refund record.",
            500
          );
        }
      }

      // Recalculate payment status from all completed refunds.
      const {
        data: refundRows,
        error: refundRowsError,
      } = await supabaseAdmin
        .from("refunds")
        .select("amount, status")
        .eq("payment_id", originalPayment.id);

      if (refundRowsError) {
        console.error(
          "Could not recalculate refunded amount:",
          refundRowsError
        );

        return jsonError(
          "Refund saved, but payment status needs synchronization.",
          500
        );
      }

      const originalAmountCents = Math.round(
        Number(originalPayment.amount) * 100
      );

      if (
        !Number.isSafeInteger(originalAmountCents) ||
        originalAmountCents <= 0
      ) {
        return jsonError(
          "Original payment amount is invalid.",
          500
        );
      }

      const completedRefundCents = (
        refundRows || []
      )
        .filter((row) => row.status === "completed")
        .reduce(
          (total, row) =>
            total + Math.round(Number(row.amount) * 100),
          0
        );

      let calculatedPaymentStatus:
        | "paid"
        | "partially_refunded"
        | "refunded";

      if (completedRefundCents >= originalAmountCents) {
        calculatedPaymentStatus = "refunded";
      } else if (completedRefundCents > 0) {
        calculatedPaymentStatus = "partially_refunded";
      } else {
        calculatedPaymentStatus = "paid";
      }

      // Only adjust known payment/refund statuses. Do not
      // overwrite unrelated payment states.
      if (
        ["paid", "partially_refunded", "refunded"].includes(
          originalPayment.status
        )
      ) {
        const { error: paymentStatusError } =
          await supabaseAdmin
            .from("payments")
            .update({
              status: calculatedPaymentStatus,
            })
            .eq("id", originalPayment.id);

        if (paymentStatusError) {
          console.error(
            "Payment refund status update failed:",
            paymentStatusError
          );

          return jsonError(
            "Refund saved, but payment status needs synchronization.",
            500
          );
        }
      }

      console.log(
        `Refund ${refund.id} synchronized as ${localRefundStatus}.`
      );

      return NextResponse.json({
        success: true,
        refundRecorded: true,
        refundId: refund.id,
        refundStatus: localRefundStatus,
        paymentId: originalPayment.id,
        paymentStatus: calculatedPaymentStatus,
      });
    }

    // ---------------------------------------------------------
    // PAYMENT EVENTS
    // ---------------------------------------------------------

    if (
      event.type !== "payment.updated" &&
      event.type !== "payment.created"
    ) {
      return NextResponse.json({
        success: true,
        ignored: true,
        eventType: event.type || null,
      });
    }

    const payment = event.data?.object?.payment;

    if (!payment?.id) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "No payment object.",
      });
    }

    const squarePaymentId = payment.id;

    if (payment.status !== "COMPLETED") {
      return NextResponse.json({
        success: true,
        ignored: true,
        paymentStatus: payment.status,
      });
    }

    // Do not overwrite any existing payment record. This is
    // especially important for refunded payment statuses.
    const {
      data: existingPayment,
      error: existingPaymentError,
    } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("square_payment_id", squarePaymentId)
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
      return NextResponse.json({
        success: true,
        alreadyRecorded: true,
        paymentId: existingPayment.id,
        paymentStatus: existingPayment.status,
      });
    }

    const squareOrderId = payment.order_id || null;

    if (!squareOrderId) {
      return jsonError(
        "Completed Square payment has no order ID.",
        400
      );
    }

    const {
      data: paymentLink,
      error: paymentLinkError,
    } = await supabaseAdmin
      .from("payment_links")
      .select(
        "id, customer_id, customer_service_id, appointment_id, job_id, amount, name, description, payment_note, square_payment_link_id, square_order_id, status"
      )
      .eq("square_order_id", squareOrderId)
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
      return jsonError(
        "No matching Dooty Done payment link found.",
        404
      );
    }

    const amountCents = payment.amount_money?.amount;

    if (amountCents == null) {
      return jsonError(
        "Square payment did not include an amount.",
        400
      );
    }

    const amount = Number(amountCents) / 100;

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError(
        "Square payment amount is invalid.",
        400
      );
    }

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
        customer_id: paymentLink.customer_id,
        customer_service_id:
          paymentLink.customer_service_id,
        appointment_id: paymentLink.appointment_id,
        amount,
        status: "paid",
        payment_method: "square_payment_link",
        paid_at:
          payment.completed_at ||
          new Date().toISOString(),
        square_payment_id: squarePaymentId,
        receipt_url: payment.receipt_url || null,
        job_id: paymentLink.job_id,
        notes: paymentNotes.join(" | "),
      })
      .select(
        "id, customer_id, amount, status, payment_method, square_payment_id, job_id"
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

    const { error: updateLinkError } =
      await supabaseAdmin
        .from("payment_links")
        .update({
          status: "paid",
          square_payment_id: squarePaymentId,
          paid_at:
            payment.completed_at ||
            new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentLink.id);

    if (updateLinkError) {
      console.error(
        "Payment was recorded, but payment link could not be updated:",
        updateLinkError
      );

      return NextResponse.json({
        success: true,
        paymentRecorded: true,
        paymentId: insertedPayment.id,
        paymentLinkUpdated: false,
        warning:
          "Payment recorded successfully, but the payment-link status could not be updated.",
      });
    }

    console.log(
      `Dooty Done payment ${insertedPayment.id} created from Square payment ${squarePaymentId}.`
    );

    return NextResponse.json({
      success: true,
      paymentRecorded: true,
      payment: insertedPayment,
      paymentLink: {
        id: paymentLink.id,
        status: "paid",
        squarePaymentId,
        squareOrderId,
      },
    });
  } catch (error) {
    console.error("Square webhook error:", error);

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
