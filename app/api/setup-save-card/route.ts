import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomUUID, createHash } from "crypto"

const SQUARE_VERSION = "2026-09-16"

function getSquareErrorMessage(result: any, fallback: string) {
  return result?.errors?.[0]?.detail || fallback
}

export async function POST(request: Request) {
  try {
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
        { error: "The setup system is not configured correctly." },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    const token = String(body?.token || "").trim()
    const sourceId = String(body?.sourceId || "").trim()

    if (!token || !sourceId) {
      return NextResponse.json(
        { error: "A valid setup link and card token are required." },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ------------------------------------------------------------
    // Validate the one-time setup token
    // ------------------------------------------------------------

    const { data: setupRows, error: setupError } = await supabase.rpc(
      "get_customer_setup_context",
      { p_token: token }
    )

    if (setupError) {
      console.error("Setup token lookup error:", setupError)
      return NextResponse.json(
        { error: "We couldn't load this setup link." },
        { status: 500 }
      )
    }

    const setup = Array.isArray(setupRows) ? setupRows[0] : null

    if (!setup) {
      return NextResponse.json(
        {
          error:
            "This setup link is invalid, expired, already used, or no longer available.",
        },
        { status: 400 }
      )
    }

    if (setup.quote_status !== "accepted") {
      return NextResponse.json(
        { error: "This recurring service has not been approved yet." },
        { status: 400 }
      )
    }

    if (
      !["weekly", "biweekly", "twice-weekly"].includes(
        setup.service_frequency || ""
      )
    ) {
      return NextResponse.json(
        { error: "This setup link is not for a recurring service." },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------
    // Prevent creating a second card on file
    // ------------------------------------------------------------

    const { data: existingPaymentMethod, error: existingPaymentMethodError } =
      await supabase
        .from("customer_payment_methods")
        .select("id, status")
        .eq("customer_id", setup.customer_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()

    if (existingPaymentMethodError) {
      console.error(
        "Existing payment method lookup error:",
        existingPaymentMethodError
      )
      return NextResponse.json(
        { error: "We couldn't check the customer's payment status." },
        { status: 500 }
      )
    }

    if (existingPaymentMethod) {
      return NextResponse.json(
        {
          error: "A payment card is already saved for this customer.",
        },
        { status: 409 }
      )
    }

    // ------------------------------------------------------------
    // Create the Square customer profile
    // ------------------------------------------------------------

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex")

    const squareCustomerResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/customers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Square-Version": SQUARE_VERSION,
        },
        body: JSON.stringify({
          idempotency_key: `setup-customer-${tokenHash.slice(0, 32)}`,
          given_name: setup.first_name,
          family_name: setup.last_name,
          email_address: setup.email || undefined,
          phone_number: setup.phone || undefined,
          reference_id: `dooty-done-customer-${setup.customer_id}`,
          address: {
            address_line_1: setup.address,
            postal_code: setup.zip_code || undefined,
            country: "US",
          },
          note: "Dooty Done recurring customer.",
        }),
      }
    )

    const squareCustomerResult = await squareCustomerResponse
      .json()
      .catch(() => null)

    if (!squareCustomerResponse.ok) {
      console.error("Square customer creation error:", squareCustomerResult)

      return NextResponse.json(
        {
          error: getSquareErrorMessage(
            squareCustomerResult,
            "Square could not create the customer profile."
          ),
        },
        { status: 400 }
      )
    }

    const squareCustomerId = squareCustomerResult?.customer?.id

    if (!squareCustomerId) {
      console.error(
        "Square customer response missing customer ID:",
        squareCustomerResult
      )

      return NextResponse.json(
        {
          error:
            "Square created the customer, but did not return a customer ID.",
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // Store the tokenized card on the Square customer
    // ------------------------------------------------------------

    const squareCardResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/cards",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Square-Version": SQUARE_VERSION,
        },
        body: JSON.stringify({
          idempotency_key: randomUUID(),
          source_id: sourceId,
          card: {
            customer_id: squareCustomerId,
            cardholder_name: `${setup.first_name} ${setup.last_name}`.trim(),
            billing_address: {
              address_line_1: setup.address,
              postal_code: setup.zip_code || undefined,
              country: "US",
            },
            reference_id: `dooty-done-customer-${setup.customer_id}`,
          },
        }),
      }
    )

    const squareCardResult = await squareCardResponse
      .json()
      .catch(() => null)

    if (!squareCardResponse.ok) {
      console.error("Square card creation error:", squareCardResult)

      return NextResponse.json(
        {
          error: getSquareErrorMessage(
            squareCardResult,
            "Square could not save this card."
          ),
        },
        { status: 400 }
      )
    }

    const squareCard = squareCardResult?.card

    if (!squareCard?.id) {
      console.error("Square card response missing card ID:", squareCardResult)

      return NextResponse.json(
        {
          error: "Square saved the card, but did not return a card ID.",
        },
        { status: 500 }
      )
    }

    // ------------------------------------------------------------
    // Save only Square IDs + masked card details in Dooty Done
    // ------------------------------------------------------------

    const { data: savedRows, error: saveError } = await supabase.rpc(
      "save_customer_payment_method_by_setup_token",
      {
        p_token: token,
        p_square_customer_id: squareCustomerId,
        p_square_card_id: squareCard.id,
        p_card_brand: squareCard.card_brand || null,
        p_last_4: squareCard.last_4 || null,
        p_exp_month: squareCard.exp_month || null,
        p_exp_year: squareCard.exp_year || null,
      }
    )

    if (saveError) {
      console.error("Save payment method error:", saveError)

      return NextResponse.json(
        {
          error:
            "The card was saved by Square, but Dooty Done could not finish saving the payment setup. Please contact us before trying again.",
        },
        { status: 500 }
      )
    }

    const saved = Array.isArray(savedRows) ? savedRows[0] : null

    return NextResponse.json({
      success: true,
      customerId: saved?.customer_id ?? setup.customer_id,
      paymentMethodId: saved?.payment_method_id ?? null,
      card: {
        brand: squareCard.card_brand || null,
        last4: squareCard.last_4 || null,
        expMonth: squareCard.exp_month || null,
        expYear: squareCard.exp_year || null,
      },
    })
  } catch (error) {
    console.error("Customer setup save card unexpected error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong saving the payment method.",
      },
      { status: 500 }
    )
  }
}
