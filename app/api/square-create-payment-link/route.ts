import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ADMIN_EMAIL = "contact.dootydone@gmail.com"

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

function getSupabaseClients() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !SUPABASE_SECRET_KEY
  ) {
    throw new Error("Required Supabase environment variables are missing.")
  }

  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  const adminClient = createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  return {
    authClient,
    adminClient,
  }
}

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------
    // Check required environment variables
    // ------------------------------------------------------------

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      return NextResponse.json(
        {
          error:
            "Required Square environment variables are missing.",
        },
        { status: 500 }
      )
    }

    const {
      authClient,
      adminClient,
    } = getSupabaseClients()

    // ------------------------------------------------------------
    // Verify admin session
    // ------------------------------------------------------------

    const authorization =
      request.headers.get("authorization")

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "You must be logged in as an administrator.",
        },
        { status: 401 }
      )
    }

    const accessToken =
      authorization.replace("Bearer ", "").trim()

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Your admin session could not be verified.",
        },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      console.error(
        "Payment link admin authentication error:",
        userError
      )

      return NextResponse.json(
        {
          error:
            "Your admin session could not be verified. Please log in again.",
        },
        { status: 401 }
      )
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        {
          error:
            "You are not authorized to create payment links.",
        },
        { status: 403 }
      )
    }

    // ------------------------------------------------------------
    // Read request
    // ------------------------------------------------------------

    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      )
    }

    const amount = Number(body.amount)

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : ""

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : ""

    const paymentNote =
      typeof body.paymentNote === "string"
        ? body.paymentNote.trim()
        : ""

    const customerId =
      body.customerId === null ||
      body.customerId === undefined ||
      body.customerId === ""
        ? null
        : Number(body.customerId)

    const customerServiceId =
      body.customerServiceId === null ||
      body.customerServiceId === undefined ||
      body.customerServiceId === ""
        ? null
        : Number(body.customerServiceId)

    const appointmentId =
      body.appointmentId === null ||
      body.appointmentId === undefined ||
      body.appointmentId === ""
        ? null
        : Number(body.appointmentId)

    const jobId =
      body.jobId === null ||
      body.jobId === undefined ||
      body.jobId === ""
        ? null
        : Number(body.jobId)

    // ------------------------------------------------------------
    // Validate request
    // ------------------------------------------------------------

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Please provide a valid payment amount.",
        },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Please provide a payment name.",
        },
        { status: 400 }
      )
    }

    if (
      customerId !== null &&
      (!Number.isInteger(customerId) || customerId <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "The selected customer is invalid.",
        },
        { status: 400 }
      )
    }

    if (
      customerServiceId !== null &&
      (!Number.isInteger(customerServiceId) ||
        customerServiceId <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "The selected customer service is invalid.",
        },
        { status: 400 }
      )
    }

    if (
      appointmentId !== null &&
      (!Number.isInteger(appointmentId) ||
        appointmentId <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "The selected appointment is invalid.",
        },
        { status: 400 }
      )
    }

    if (
      jobId !== null &&
      (!Number.isInteger(jobId) || jobId <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "The selected job is invalid.",
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // Verify customer exists when supplied
    // ------------------------------------------------------------

    if (customerId !== null) {
      const {
        data: customer,
        error: customerError,
      } = await adminClient
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .maybeSingle()

      if (customerError) {
        console.error(
          "Payment link customer lookup error:",
          customerError
        )

        return NextResponse.json(
          {
            error:
              "We couldn't verify the selected customer.",
          },
          { status: 500 }
        )
      }

      if (!customer) {
        return NextResponse.json(
          {
            error:
              "The selected customer could not be found.",
          },
          { status: 400 }
        )
      }
    }

    // ------------------------------------------------------------
    // Create Square payment link
    // ------------------------------------------------------------

    const idempotencyKey = crypto.randomUUID()

    const squareResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
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

          payment_note:
            paymentNote || undefined,

          checkout_options: {
            ask_for_shipping_address: false,
          },
        }),
      }
    )

    const squareResult =
      await squareResponse.json().catch(() => null)

    if (!squareResponse.ok) {
      console.error(
        "Square payment link creation error:",
        squareResult
      )

      const squareMessage =
        squareResult?.errors?.[0]?.detail ||
        "Square could not create the payment link."

      return NextResponse.json(
        {
          error: squareMessage,
        },
        { status: 400 }
      )
    }

    const squarePaymentLink =
      squareResult?.payment_link

    if (!squarePaymentLink?.id) {
      console.error(
        "Square payment link response missing payment link:",
        squareResult
      )

      return NextResponse.json(
        {
          error:
            "Square created the request, but did not return a payment-link ID.",
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // Save Dooty Done payment-link record
    //
    // IMPORTANT:
    // This uses the Supabase SECRET key so the server-side
    // operation is not blocked by customer-facing RLS policies.
    // ------------------------------------------------------------

    const paymentLinkRecord = {
      customer_id: customerId,
      customer_service_id: customerServiceId,
      appointment_id: appointmentId,
      job_id: jobId,
      amount,
      name,
      description: description || null,
      payment_note: paymentNote || null,
      square_payment_link_id:
        squarePaymentLink.id,
      square_order_id:
        squarePaymentLink.order_id || null,
      square_url:
        squarePaymentLink.url || null,
      square_long_url:
        squarePaymentLink.long_url || null,
      status: "created",
    }

    const {
      data: savedPaymentLink,
      error: paymentLinkInsertError,
    } = await adminClient
      .from("payment_links")
      .insert(paymentLinkRecord)
      .select(
        "id, customer_id, customer_service_id, appointment_id, job_id, amount, name, description, payment_note, square_payment_link_id, square_order_id, square_url, square_long_url, status, created_at"
      )
      .single()

    if (paymentLinkInsertError) {
      console.error(
        "Payment link record insert error after Square success:",
        paymentLinkInsertError
      )

      return NextResponse.json(
        {
          error:
            "Square created the payment link, but Dooty Done could not save the payment-link record.",
          squarePaymentLinkId:
            squarePaymentLink.id,
          squareOrderId:
            squarePaymentLink.order_id || null,
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // Success
    // ------------------------------------------------------------

    return NextResponse.json({
      success: true,

      paymentLink: {
        id:
          savedPaymentLink.id,
        url:
          savedPaymentLink.square_url,
        longUrl:
          savedPaymentLink.square_long_url,
        orderId:
          savedPaymentLink.square_order_id,
        amount:
          Number(savedPaymentLink.amount),
        name:
          savedPaymentLink.name,
        description:
          savedPaymentLink.description || "",
        customerId:
          savedPaymentLink.customer_id,
        createdAt:
          savedPaymentLink.created_at,
      },
    })
  } catch (error) {
    console.error(
      "Square payment link route unexpected error:",
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong creating the payment link.",
      },
      { status: 500 }
    )
  }
}