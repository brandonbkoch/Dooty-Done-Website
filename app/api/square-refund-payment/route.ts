import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ADMIN_EMAIL = "contact.dootydone@gmail.com"

export async function POST(request: Request) {
  try {
    // ------------------------------------------------------------
    // ADMIN AUTHORIZATION
    // ------------------------------------------------------------

    const authHeader = request.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing admin authorization." },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace("Bearer ", "").trim()

    // ------------------------------------------------------------
    // ENVIRONMENT VARIABLES
    // ------------------------------------------------------------

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN

    if (!supabaseUrl || !supabaseKey || !squareAccessToken) {
      console.error("Missing required environment variables.")

      return NextResponse.json(
        { error: "Refund system is not configured correctly." },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // SUPABASE CLIENT
    // ------------------------------------------------------------

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    // ------------------------------------------------------------
    // VERIFY ADMIN SESSION
    // ------------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your admin session could not be verified." },
        { status: 401 }
      )
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "You are not authorized to process refunds." },
        { status: 403 }
      )
    }

    // ------------------------------------------------------------
    // READ REQUEST
    // ------------------------------------------------------------

    const body = await request.json().catch(() => null)

    const paymentId = Number(body?.paymentId)
    const requestedAmount = Number(body?.amount)
    const reason =
      typeof body?.reason === "string"
        ? body.reason.trim()
        : ""

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        { error: "A valid payment ID is required." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json(
        { error: "A valid refund amount is required." },
        { status: 400 }
      )
    }

    // Square requires money in cents.
    const amountCents = Math.round(requestedAmount * 100)
    const normalizedAmount = amountCents / 100

    // Prevent values with more than two decimal places.
    if (Math.abs(requestedAmount - normalizedAmount) > 0.000001) {
      return NextResponse.json(
        { error: "Refund amounts can only have two decimal places." },
        { status: 400 }
      )
    }

    if (reason.length > 192) {
      return NextResponse.json(
        { error: "Refund reason must be 192 characters or fewer." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // LOAD ORIGINAL PAYMENT
    // ------------------------------------------------------------

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(
        "id, customer_id, customer_service_id, job_id, amount, status, payment_method, square_payment_id, receipt_url"
      )
      .eq("id", paymentId)
      .maybeSingle()

    if (paymentError) {
      console.error("Payment lookup error:", paymentError)

      return NextResponse.json(
        { error: "We couldn't load the payment." },
        { status: 500 }
      )
    }

    if (!payment) {
      return NextResponse.json(
        { error: "That payment could not be found." },
        { status: 404 }
      )
    }

    // ------------------------------------------------------------
    // VERIFY PAYMENT IS REFUNDABLE
    // ------------------------------------------------------------

    if (payment.status !== "paid") {
      return NextResponse.json(
        {
          error:
            "Only completed paid transactions can be refunded.",
        },
        { status: 400 }
      )
    }

    if (!payment.square_payment_id) {
      return NextResponse.json(
        {
          error:
            "This payment does not have a Square payment ID and cannot be refunded through Square.",
        },
        { status: 400 }
      )
    }

    if (payment.payment_method !== "square_card") {
      return NextResponse.json(
        {
          error:
            "This payment was not processed through a Square card payment.",
        },
        { status: 400 }
      )
    }

    const originalAmountCents = Math.round(Number(payment.amount) * 100)

    if (
      !Number.isFinite(originalAmountCents) ||
      originalAmountCents <= 0
    ) {
      return NextResponse.json(
        { error: "The original payment amount is invalid." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // CHECK PREVIOUS REFUNDS
    // ------------------------------------------------------------

    const { data: existingRefunds, error: refundsLookupError } =
      await supabase
        .from("refunds")
        .select("id, amount, status, square_refund_id")
        .eq("payment_id", payment.id)

    if (refundsLookupError) {
      console.error(
        "Existing refunds lookup error:",
        refundsLookupError
      )

      return NextResponse.json(
        { error: "We couldn't check previous refunds for this payment." },
        { status: 500 }
      )
    }

    const previouslyRefundedCents = (existingRefunds || [])
      .filter(
        (refund) =>
          refund.status === "pending" ||
          refund.status === "completed"
      )
      .reduce(
        (total, refund) =>
          total + Math.round(Number(refund.amount) * 100),
        0
      )

    const remainingRefundableCents =
      originalAmountCents - previouslyRefundedCents

    if (remainingRefundableCents <= 0) {
      return NextResponse.json(
        {
          error:
            "This payment has already been fully refunded or has refunds currently processing.",
        },
        { status: 400 }
      )
    }

    if (amountCents > remainingRefundableCents) {
      return NextResponse.json(
        {
          error: `The maximum remaining refundable amount is $${(
            remainingRefundableCents / 100
          ).toFixed(2)}.`,
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // CREATE UNIQUE IDEMPOTENCY KEY
    // ------------------------------------------------------------

    const idempotencyKey = crypto.randomUUID()

    // ------------------------------------------------------------
    // CREATE LOCAL REFUND RECORD
    // ------------------------------------------------------------

    const { data: refundRecord, error: refundInsertError } =
      await supabase
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
        .single()

    if (refundInsertError || !refundRecord) {
      console.error(
        "Refund record insert error:",
        refundInsertError
      )

      return NextResponse.json(
        { error: "We couldn't create the refund record." },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // SEND REFUND TO SQUARE SANDBOX
    // ------------------------------------------------------------

    const squareResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/refunds",
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
      }
    )

    const squareResult = await squareResponse.json().catch(() => null)

    // ------------------------------------------------------------
    // HANDLE SQUARE ERROR
    // ------------------------------------------------------------

    if (!squareResponse.ok) {
      console.error("Square refund error:", squareResult)

      const squareMessage =
        squareResult?.errors?.[0]?.detail ||
        "Square could not process the refund."

      await supabase
        .from("refunds")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundRecord.id)

      return NextResponse.json(
        {
          error: squareMessage,
          refundId: refundRecord.id,
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // READ SQUARE REFUND
    // ------------------------------------------------------------

    const squareRefund = squareResult?.refund

    if (!squareRefund?.id) {
      console.error(
        "Square refund response missing refund ID:",
        squareResult
      )

      await supabase
        .from("refunds")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundRecord.id)

      return NextResponse.json(
        {
          error:
            "Square processed the request but did not return a refund ID.",
          refundId: refundRecord.id,
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // SAVE SQUARE REFUND RESULT
    // ------------------------------------------------------------

    const squareStatus = String(
      squareRefund.status || "PENDING"
    ).toUpperCase()

    let localStatus: "pending" | "completed" | "failed" | "canceled" =
      "pending"

    if (squareStatus === "COMPLETED") {
      localStatus = "completed"
    } else if (
      squareStatus === "FAILED" ||
      squareStatus === "REJECTED"
    ) {
      localStatus = "failed"
    }

    const processedAt =
      localStatus === "completed"
        ? squareRefund.updated_at ||
          squareRefund.created_at ||
          new Date().toISOString()
        : null

    const { data: updatedRefund, error: refundUpdateError } =
      await supabase
        .from("refunds")
        .update({
          status: localStatus,
          square_refund_id: squareRefund.id,
          updated_at: new Date().toISOString(),
          processed_at: processedAt,
        })
        .eq("id", refundRecord.id)
        .select(
          "id, payment_id, customer_id, job_id, amount, status, square_refund_id, reason, created_at, updated_at, processed_at"
        )
        .single()

    if (refundUpdateError || !updatedRefund) {
      console.error(
        "Refund record update error after Square success:",
        refundUpdateError
      )

      return NextResponse.json(
        {
          error:
            "Square accepted the refund, but Dooty Done could not update the local refund record.",
          refundProcessed: true,
          squareRefundId: squareRefund.id,
          refundId: refundRecord.id,
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // SUCCESS
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
    })
  } catch (error) {
    console.error("Square refund route unexpected error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong processing the refund.",
      },
      { status: 500 }
    )
  }
}