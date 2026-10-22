
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const ADMIN_EMAIL = "contact.dootydone@gmail.com";

type RefundStatus = "pending" | "completed" | "failed";

type RefundRow = {
  amount: number | string;
  status: string;
};

function jsonError(
  message: string,
  status = 400,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success: false, error: message, ...extra },
    { status }
  );
}

function getSquareApiBaseUrl(): string | null {
  const configured = process.env.SQUARE_API_BASE_URL;

  if (!configured) {
    return null;
  }

  try {
    const parsed = new URL(configured);
    const allowedHosts = [
      "connect.squareup.com",
      "connect.squareupsandbox.com",
    ];

    if (
      parsed.protocol !== "https:" ||
      !allowedHosts.includes(parsed.hostname) ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function mapSquareRefundStatus(
  status: string | undefined
): RefundStatus {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return "completed";
    case "FAILED":
    case "REJECTED":
    case "CANCELED":
      return "failed";
    case "PENDING":
    case "APPROVED":
    default:
      return "pending";
  }
}

async function updatePaymentRefundStatus(
  supabaseAdmin: any,
  paymentId: number,
  originalAmount: number
) {
  const { data: refundRows, error: refundRowsError } =
    await supabaseAdmin
      .from("refunds")
      .select("amount, status")
      .eq("payment_id", paymentId);

  if (refundRowsError) {
    throw new Error(
      "Refund was recorded, but completed refunds could not be recalculated."
    );
  }

  const originalAmountCents = Math.round(
    Number(originalAmount) * 100
  );

  const typedRefundRows: RefundRow[] = (
    refundRows || []
  ) as RefundRow[];

  const completedRefundCents = typedRefundRows
    .filter(
      (row: RefundRow) => row.status === "completed"
    )
    .reduce(
      (total: number, row: RefundRow) =>
        total + Math.round(Number(row.amount) * 100),
      0
    );

  let paymentStatus:
    | "paid"
    | "partially_refunded"
    | "refunded";

  if (completedRefundCents >= originalAmountCents) {
    paymentStatus = "refunded";
  } else if (completedRefundCents > 0) {
    paymentStatus = "partially_refunded";
  } else {
    paymentStatus = "paid";
  }

  const { error: paymentUpdateError } =
    await supabaseAdmin
      .from("payments")
      .update({ status: paymentStatus })
      .eq("id", paymentId);

  if (paymentUpdateError) {
    throw new Error(
      "Refund was recorded, but the payment status could not be updated."
    );
  }

  return paymentStatus;
}

export async function POST(request: Request) {
  let refundRecordId: number | null = null;

  try {
    // ------------------------------------------------------------
    // 1. Authenticate the administrator
    // ------------------------------------------------------------

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(
        "Missing admin authorization.",
        401
      );
    }

    const accessToken = authHeader
      .slice("Bearer ".length)
      .trim();

    if (!accessToken) {
      return jsonError(
        "Missing admin authorization.",
        401
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    const squareAccessToken =
      process.env.SQUARE_ACCESS_TOKEN;

    const squareApiBaseUrl = getSquareApiBaseUrl();

    if (
      !supabaseUrl ||
      !supabasePublishableKey ||
      !supabaseSecretKey ||
      !squareAccessToken ||
      !squareApiBaseUrl
    ) {
      console.error(
        "Refund system configuration is incomplete."
      );

      return jsonError(
        "Refund system is not configured correctly.",
        500
      );
    }

    // Use the caller's token only to verify their identity.
    const supabaseAuth = createClient<any>(
      supabaseUrl,
      supabasePublishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return jsonError(
        "Your admin session could not be verified.",
        401
      );
    }

    if (
      user.email?.toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      return jsonError(
        "You are not authorized to process refunds.",
        403
      );
    }

    // Use the server-side Supabase secret only after verifying
    // the authenticated administrator.
    const supabaseAdmin = createClient<any>(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // ------------------------------------------------------------
    // 2. Validate the request
    // ------------------------------------------------------------

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonError("Invalid request body.", 400);
    }

    const paymentId = Number(body.paymentId);
    const requestedAmount = Number(body.amount);

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (
      !Number.isSafeInteger(paymentId) ||
      paymentId <= 0
    ) {
      return jsonError(
        "A valid payment ID is required.",
        400
      );
    }

    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0
    ) {
      return jsonError(
        "A valid refund amount is required.",
        400
      );
    }

    const amountCents = Math.round(
      requestedAmount * 100
    );

    const normalizedAmount = amountCents / 100;

    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      Math.abs(requestedAmount - normalizedAmount) >
        0.000001
    ) {
      return jsonError(
        "Refund amounts must be valid amounts with no more than two decimal places.",
        400
      );
    }

    if (reason.length > 192) {
      return jsonError(
        "Refund reason must be 192 characters or fewer.",
        400
      );
    }

    // ------------------------------------------------------------
    // 3. Load and validate the original payment
    // ------------------------------------------------------------

    const {
      data: payment,
      error: paymentError,
    } = await supabaseAdmin
      .from("payments")
      .select(
        "id, customer_id, customer_service_id, job_id, amount, status, payment_method, square_payment_id, receipt_url"
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError) {
      console.error("Payment lookup error:", paymentError);

      return jsonError(
        "We couldn't load the payment.",
        500
      );
    }

    if (!payment) {
      return jsonError(
        "That payment could not be found.",
        404
      );
    }

    // Permit additional refunds after a partial refund.
    if (
      payment.status !== "paid" &&
      payment.status !== "partially_refunded"
    ) {
      return jsonError(
        "Only paid or partially refunded payments can be refunded. Fully refunded payments cannot be refunded again.",
        400
      );
    }

    if (!payment.square_payment_id) {
      return jsonError(
        "This payment does not have a Square payment ID and cannot be refunded through Square.",
        400
      );
    }

    if (payment.payment_method !== "square_card") {
      return jsonError(
        "This payment was not processed through a Square card payment.",
        400
      );
    }

    const originalAmountCents = Math.round(
      Number(payment.amount) * 100
    );

    if (
      !Number.isSafeInteger(originalAmountCents) ||
      originalAmountCents <= 0
    ) {
      return jsonError(
        "The original payment amount is invalid.",
        400
      );
    }

    // ------------------------------------------------------------
    // 4. Check existing refunds
    // ------------------------------------------------------------

    const {
      data: existingRefunds,
      error: refundsLookupError,
    } = await supabaseAdmin
      .from("refunds")
      .select(
        "id, amount, status, square_refund_id"
      )
      .eq("payment_id", payment.id);

    if (refundsLookupError) {
      console.error(
        "Existing refunds lookup error:",
        refundsLookupError
      );

      return jsonError(
        "We couldn't check previous refunds for this payment.",
        500
      );
    }

    // A pending refund might already have been accepted by Square.
    // Require reconciliation before allowing another attempt.
    const pendingRefund = (existingRefunds || []).find(
      (refund: {
        id: number;
        amount: number | string;
        status: string;
        square_refund_id: string | null;
      }) => refund.status === "pending"
    );

    if (pendingRefund) {
      return jsonError(
        "A refund is already pending for this payment. Check Square and reconcile the existing refund before trying again.",
        409,
        { refundId: pendingRefund.id }
      );
    }

    const completedExistingRefunds = (
      existingRefunds || []
    ) as RefundRow[];

    const previouslyRefundedCents =
      completedExistingRefunds
        .filter(
          (refund: RefundRow) =>
            refund.status === "completed"
        )
        .reduce(
          (total: number, refund: RefundRow) =>
            total +
            Math.round(Number(refund.amount) * 100),
          0
        );

    const remainingRefundableCents =
      originalAmountCents - previouslyRefundedCents;

    if (remainingRefundableCents <= 0) {
      return jsonError(
        "This payment has already been fully refunded.",
        400
      );
    }

    if (amountCents > remainingRefundableCents) {
      return jsonError(
        `The maximum remaining refundable amount is $${(
          remainingRefundableCents / 100
        ).toFixed(2)}.`,
        400
      );
    }

    // ------------------------------------------------------------
    // 5. Create a local pending record before contacting Square
    // ------------------------------------------------------------

    const idempotencyKey = crypto.randomUUID();

    const {
      data: refundRecord,
      error: refundInsertError,
    } = await supabaseAdmin
      .from("refunds")
      .insert({
        payment_id: payment.id,
        customer_id: payment.customer_id,
        job_id: payment.job_id,
        amount: normalizedAmount,
        status: "pending",
        square_idempotency_key: idempotencyKey,
        reason: reason || null,
      })
      .select(
        "id, payment_id, customer_id, job_id, amount, status, square_refund_id, reason, created_at, updated_at, processed_at"
      )
      .single();

    if (refundInsertError || !refundRecord) {
      console.error(
        "Refund record insert error:",
        refundInsertError
      );

      return jsonError(
        "We couldn't create the refund record.",
        500
      );
    }

    refundRecordId = refundRecord.id;

    // ------------------------------------------------------------
    // 6. Send the refund request to Square
    // ------------------------------------------------------------

    let squareResponse: Response;

    try {
      squareResponse = await fetch(
        `${squareApiBaseUrl}/v2/refunds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${squareAccessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Square-Version": "2026-09-16",
          },
          body: JSON.stringify({
            idempotency_key: idempotencyKey,
            payment_id: payment.square_payment_id,
            amount_money: {
              amount: amountCents,
              currency: "USD",
            },
            reason: reason || "Dooty Done customer refund",
          }),
          cache: "no-store",
        }
      );
    } catch (networkError) {
      // The request outcome is uncertain. Leave the record pending
      // so another attempt cannot accidentally issue a second refund.
      console.error(
        "Square refund request outcome is unknown:",
        networkError
      );

      return jsonError(
        "We couldn't confirm Square's response. The refund is marked pending to prevent a duplicate. Check Square before retrying.",
        502,
        {
          refundId: refundRecord.id,
          refundOutcome: "unknown",
        }
      );
    }

    const squareResult = await squareResponse
      .json()
      .catch(() => null);

    // ------------------------------------------------------------
    // 7. Handle Square responses safely
    // ------------------------------------------------------------

    if (!squareResponse.ok) {
      console.error(
        "Square refund API response:",
        squareResponse.status,
        squareResult
      );

      const squareMessage =
        squareResult?.errors?.[0]?.detail ||
        "Square did not confirm the refund outcome.";

      // Only mark explicit client-side rejection responses failed.
      // Timeouts, rate limits, conflicts, and server errors remain
      // pending until their outcome has been checked.
      const definitiveRejectionStatuses = [
        400, 401, 403, 404, 422,
      ];

      if (
        definitiveRejectionStatuses.includes(
          squareResponse.status
        )
      ) {
        const { error: failedUpdateError } =
          await supabaseAdmin
            .from("refunds")
            .update({
              status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", refundRecord.id);

        if (failedUpdateError) {
          console.error(
            "Could not record rejected refund:",
            failedUpdateError
          );
        }

        return jsonError(
          squareMessage,
          400,
          { refundId: refundRecord.id }
        );
      }

      return jsonError(
        "Square did not confirm whether the refund was processed. The record remains pending. Check Square before retrying.",
        502,
        {
          refundId: refundRecord.id,
          refundOutcome: "unknown",
        }
      );
    }

    const squareRefund = squareResult?.refund;

    if (!squareRefund?.id) {
      console.error(
        "Square returned no refund ID:",
        squareResult
      );

      // Do not mark this failed: Square may have accepted the refund.
      return jsonError(
        "Square returned a response without a refund ID. The refund remains pending until its outcome is verified.",
        502,
        {
          refundId: refundRecord.id,
          refundOutcome: "unknown",
        }
      );
    }

    // ------------------------------------------------------------
    // 8. Save the Square refund result
    // ------------------------------------------------------------

    const localStatus = mapSquareRefundStatus(
      squareRefund.status
    );

    const processedAt =
      localStatus === "completed"
        ? squareRefund.updated_at ||
          squareRefund.created_at ||
          new Date().toISOString()
        : null;

    // A refund.created/refund.updated webhook may arrive before this
    // request saves Square's refund ID. If it already created a row,
    // update that row instead of creating a duplicate refund record.
    const {
      data: webhookRefund,
      error: webhookRefundLookupError,
    } = await supabaseAdmin
      .from("refunds")
      .select("id, payment_id, amount, status, processed_at")
      .eq("square_refund_id", squareRefund.id)
      .maybeSingle();

    if (webhookRefundLookupError) {
      console.error(
        "Could not look up refund by Square ID:",
        webhookRefundLookupError
      );

      return jsonError(
        "Square returned a refund ID, but Dooty Done could not verify its local record. Do not retry until the refund is reconciled.",
        500,
        {
          refundId: refundRecord.id,
          squareRefundId: squareRefund.id,
          refundProcessed: true,
        }
      );
    }

    if (
      webhookRefund &&
      webhookRefund.payment_id !== payment.id
    ) {
      console.error(
        "Square refund ID is linked to another payment:",
        squareRefund.id
      );

      return jsonError(
        "The Square refund ID is already linked to a different payment. Manual reconciliation is required.",
        500,
        {
          refundId: refundRecord.id,
          squareRefundId: squareRefund.id,
          refundProcessed: true,
        }
      );
    }

    const canonicalRefundId =
      webhookRefund?.id ?? refundRecord.id;

    // Never downgrade a refund already marked completed by the webhook.
    const finalStatus: RefundStatus =
      webhookRefund?.status === "completed"
        ? "completed"
        : localStatus;

    const finalProcessedAt =
      finalStatus === "completed"
        ? webhookRefund?.processed_at ||
          processedAt ||
          new Date().toISOString()
        : null;

    const {
      data: updatedRefund,
      error: refundUpdateError,
    } = await supabaseAdmin
      .from("refunds")
      .update({
        payment_id: payment.id,
        customer_id: payment.customer_id,
        job_id: payment.job_id,
        amount: normalizedAmount,
        status: finalStatus,
        square_refund_id: squareRefund.id,
        reason:
          reason ||
          squareRefund.reason ||
          "Dooty Done customer refund",
        updated_at: new Date().toISOString(),
        processed_at: finalProcessedAt,
      })
      .eq("id", canonicalRefundId)
      .select(
        "id, payment_id, customer_id, job_id, amount, status, square_refund_id, reason, created_at, updated_at, processed_at"
      )
      .single();

    if (refundUpdateError || !updatedRefund) {
      console.error(
        "Refund record update failed after Square response:",
        refundUpdateError
      );

      return jsonError(
        "Square returned a refund ID, but Dooty Done could not update its refund record. Do not retry; reconcile this refund first.",
        500,
        {
          refundId: refundRecord.id,
          squareRefundId: squareRefund.id,
          refundProcessed: true,
        }
      );
    }

    // If the webhook created a separate canonical record, remove
    // the original pending row now that the Square ID is reconciled.
    if (canonicalRefundId !== refundRecord.id) {
      const { error: duplicateDeleteError } =
        await supabaseAdmin
          .from("refunds")
          .delete()
          .eq("id", refundRecord.id);

      if (duplicateDeleteError) {
        console.error(
          "Could not remove duplicate pending refund record:",
          duplicateDeleteError
        );

        return jsonError(
          "The refund was recorded, but duplicate local records may need reconciliation.",
          500,
          {
            refundId: updatedRefund.id,
            squareRefundId: squareRefund.id,
            refundProcessed: true,
          }
        );
      }
    }

    // ------------------------------------------------------------
    // 9. Synchronize the payment status after completed refunds
    // ------------------------------------------------------------

    let paymentStatus = payment.status;

    if (finalStatus === "completed") {
      try {
        paymentStatus = await updatePaymentRefundStatus(
          supabaseAdmin,
          payment.id,
          payment.amount
        );
      } catch (statusError) {
        console.error(
          "Refund saved but payment status synchronization failed:",
          statusError
        );

        return jsonError(
          "The refund was recorded, but the payment status could not be synchronized. Do not retry the refund.",
          500,
          {
            refundId: updatedRefund.id,
            squareRefundId: squareRefund.id,
            refundProcessed: true,
          }
        );
      }
    }

    // ------------------------------------------------------------
    // 10. Success
    // ------------------------------------------------------------

    return NextResponse.json({
      success: true,
      refund: {
        id: updatedRefund.id,
        paymentId: updatedRefund.payment_id,
        amount: updatedRefund.amount,
        status: updatedRefund.status,
        squareRefundId: updatedRefund.square_refund_id,
        reason: updatedRefund.reason,
        createdAt: updatedRefund.created_at,
        processedAt: updatedRefund.processed_at,
      },
      paymentStatus,
    });
  } catch (error) {
    console.error(
      "Square refund route unexpected error:",
      error
    );

    // If a local refund record was already created, do not
    // automatically mark it failed: Square may have processed it.
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while processing the refund.",
        ...(refundRecordId
          ? {
              refundId: refundRecordId,
              refundOutcome: "unknown",
              message:
                "Check Square and reconcile this refund before retrying.",
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
