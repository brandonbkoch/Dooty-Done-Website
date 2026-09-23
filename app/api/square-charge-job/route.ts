import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ADMIN_EMAIL = "contact.dootydone@gmail.com"

const SQUARE_API_BASE_URL =
  process.env.SQUARE_API_BASE_URL ||
  "https://connect.squareupsandbox.com"

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing admin authorization." },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace("Bearer ", "").trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN
    const squareLocationId = process.env.SQUARE_LOCATION_ID

    if (
      !supabaseUrl ||
      !supabaseKey ||
      !squareAccessToken ||
      !squareLocationId
    ) {
      console.error("Missing required environment variables.")
      return NextResponse.json(
        { error: "Payment system is not configured correctly." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

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
        { error: "You are not authorized to process payments." },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const jobId = Number(body?.jobId)

    if (!Number.isInteger(jobId) || jobId <= 0) {
      return NextResponse.json(
        { error: "A valid job ID is required." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // Prevent duplicate payments for the same job
    // ------------------------------------------------------------

    const { data: existingPayment, error: existingPaymentError } =
      await supabase
        .from("payments")
        .select(
          "id, job_id, amount, status, payment_method, paid_at, square_payment_id, receipt_url"
        )
        .eq("job_id", jobId)
        .maybeSingle()

    if (existingPaymentError) {
      console.error("Existing payment lookup error:", existingPaymentError)
      return NextResponse.json(
        { error: "We couldn't check whether this job was already paid." },
        { status: 500 }
      )
    }

    if (existingPayment) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        freeCleanupApplied:
          existingPayment.payment_method === "free_initial_cleanup",
        payment: {
          id: existingPayment.id,
          jobId: existingPayment.job_id,
          amount: Number(existingPayment.amount),
          status: existingPayment.status,
          squarePaymentId: existingPayment.square_payment_id,
          receiptUrl: existingPayment.receipt_url,
          cardBrand: null,
          last4: null,
        },
      })
    }

    // ------------------------------------------------------------
    // Load the completed job
    // ------------------------------------------------------------

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "id, customer_service_id, status, scheduled_for, completed_at"
      )
      .eq("id", jobId)
      .maybeSingle()

    if (jobError) {
      console.error("Job lookup error:", jobError)
      return NextResponse.json(
        { error: "We couldn't load this job." },
        { status: 500 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: "That job could not be found." },
        { status: 404 }
      )
    }

    if (job.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed jobs can be charged." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // Load customer service
    // ------------------------------------------------------------

    const { data: customerService, error: customerServiceError } =
      await supabase
        .from("customer_services")
        .select("id, customer_id, agreed_price, status")
        .eq("id", job.customer_service_id)
        .maybeSingle()

    if (customerServiceError) {
      console.error(
        "Customer service lookup error:",
        customerServiceError
      )
      return NextResponse.json(
        { error: "We couldn't load this customer's service." },
        { status: 500 }
      )
    }

    if (!customerService) {
      return NextResponse.json(
        { error: "This job is missing its customer service." },
        { status: 400 }
      )
    }

    if (customerService.status !== "active") {
      return NextResponse.json(
        { error: "This recurring service is not active." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // Load customer
    // ------------------------------------------------------------

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, email, free_initial_cleanup_used, free_initial_cleanup_date"
      )
      .eq("id", customerService.customer_id)
      .maybeSingle()

    if (customerError) {
      console.error("Customer lookup error:", customerError)
      return NextResponse.json(
        { error: "We couldn't load this customer." },
        { status: 500 }
      )
    }

    if (!customer) {
      return NextResponse.json(
        { error: "This job is missing its customer." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // FIRST CLEANUP FREE
    //
    // free_initial_cleanup_used = false means the free cleanup
    // has not yet been used.
    // ------------------------------------------------------------

    if (customer.free_initial_cleanup_used === false) {
      const freeCleanupDate = new Date().toISOString().slice(0, 10)

      const { data: claimedCustomer, error: claimError } = await supabase
        .from("customers")
        .update({
          free_initial_cleanup_used: true,
          free_initial_cleanup_date: freeCleanupDate,
        })
        .eq("id", customer.id)
        .eq("free_initial_cleanup_used", false)
        .select("id")
        .maybeSingle()

      if (claimError) {
        console.error("Free cleanup claim error:", claimError)

        return NextResponse.json(
          {
            error:
              "We couldn't confirm the free first cleanup status, so no payment was processed.",
          },
          { status: 500 }
        )
      }

      if (claimedCustomer) {
        const { data: freePayment, error: freePaymentError } =
          await supabase
            .from("payments")
            .insert({
              customer_id: customer.id,
              customer_service_id: customerService.id,
              job_id: job.id,
              amount: 0,
              status: "paid",
              payment_method: "free_initial_cleanup",
              paid_at: new Date().toISOString(),
              notes: "First cleanup free for new recurring customer.",
            })
            .select(
              "id, job_id, amount, status, payment_method, paid_at, square_payment_id, receipt_url"
            )
            .maybeSingle()

        if (freePaymentError) {
          console.error(
            "Free cleanup payment record error:",
            freePaymentError
          )

          return NextResponse.json(
            {
              error:
                "The free cleanup was applied, but we couldn't save its payment record.",
            },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          alreadyPaid: false,
          freeCleanupApplied: true,
          payment: {
            id: freePayment?.id ?? null,
            jobId: job.id,
            amount: 0,
            status: "paid",
            squarePaymentId: null,
            receiptUrl: null,
            cardBrand: null,
            last4: null,
          },
        })
      }
    }

    // ------------------------------------------------------------
    // Load active Square card on file
    // ------------------------------------------------------------

    const { data: paymentMethod, error: paymentMethodError } =
      await supabase
        .from("customer_payment_methods")
        .select(
          "id, square_customer_id, square_card_id, card_brand, last_4, status"
        )
        .eq("customer_id", customer.id)
        .eq("status", "active")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (paymentMethodError) {
      console.error(
        "Payment method lookup error:",
        paymentMethodError
      )
      return NextResponse.json(
        { error: "We couldn't load the customer's card on file." },
        { status: 500 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        {
          error:
            "This customer does not have an active card on file. The job is completed, but no payment was processed.",
        },
        { status: 400 }
      )
    }

    const agreedPrice = Number(customerService.agreed_price)

    if (!Number.isFinite(agreedPrice) || agreedPrice <= 0) {
      return NextResponse.json(
        { error: "This customer's agreed service price is invalid." },
        { status: 400 }
      )
    }

    const amountCents = Math.round(agreedPrice * 100)

    // ------------------------------------------------------------
    // Charge Square
    // ------------------------------------------------------------

    const squareResponse = await fetch(
      `${SQUARE_API_BASE_URL}/v2/payments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          idempotency_key: `dooty-done-job-${job.id}`,
          source_id: paymentMethod.square_card_id,
          amount_money: {
            amount: amountCents,
            currency: "USD",
          },
          location_id: squareLocationId,
          autocomplete: true,
          customer_id: paymentMethod.square_customer_id,
          reference_id: `job-${job.id}`,
          note: `Dooty Done service job ${job.id}`,
        }),
      }
    )

    const squareResult = await squareResponse.json().catch(() => null)

    if (!squareResponse.ok) {
      console.error("Square payment error:", squareResult)

      const squareMessage =
        squareResult?.errors?.[0]?.detail ||
        "Square could not process the payment."

      return NextResponse.json(
        { error: squareMessage },
        { status: 400 }
      )
    }

    const squarePayment = squareResult?.payment

    if (!squarePayment?.id) {
      console.error(
        "Square payment response missing payment ID:",
        squareResult
      )

      return NextResponse.json(
        {
          error:
            "Square processed the request, but did not return a payment ID.",
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // Save Dooty Done payment record
    // ------------------------------------------------------------

    const { data: paymentRecord, error: paymentInsertError } =
      await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          customer_service_id: customerService.id,
          job_id: job.id,
          amount: agreedPrice,
          status:
            squarePayment.status === "COMPLETED"
              ? "paid"
              : String(squarePayment.status || "pending").toLowerCase(),
          payment_method: "square_card",
          paid_at:
            squarePayment.status === "COMPLETED"
              ? new Date().toISOString()
              : null,
          square_payment_id: squarePayment.id,
          receipt_url: squarePayment.receipt_url || null,
          notes: `Square payment for Dooty Done service job ${job.id}.`,
        })
        .select(
          "id, job_id, amount, status, payment_method, paid_at, square_payment_id, receipt_url"
        )
        .maybeSingle()

    if (paymentInsertError) {
      console.error(
        "Payment record insert error after Square success:",
        paymentInsertError
      )

      return NextResponse.json(
        {
          error:
            "Square processed the payment, but Dooty Done could not save the payment record.",
          paymentProcessed: true,
          squarePaymentId: squarePayment.id,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: false,
      freeCleanupApplied: false,
      payment: {
        id: paymentRecord?.id ?? null,
        jobId: job.id,
        amount: agreedPrice,
        status:
          squarePayment.status === "COMPLETED"
            ? "paid"
            : String(squarePayment.status || "pending").toLowerCase(),
        squarePaymentId: squarePayment.id,
        receiptUrl: squarePayment.receipt_url || null,
        cardBrand:
          squarePayment.card_details?.card?.card_brand ||
          paymentMethod.card_brand ||
          null,
        last4:
          squarePayment.card_details?.card?.last_4 ||
          paymentMethod.last_4 ||
          null,
      },
    })
  } catch (error) {
    console.error("Square charge route unexpected error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong processing the payment.",
      },
      { status: 500 }
    )
  }
}