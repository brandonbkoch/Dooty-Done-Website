import { createClient } from "@supabase/supabase-js"

type SaveCardBody = {
  customerId?: number
  sourceId?: string
  consentGiven?: boolean
}

export async function POST(request: Request) {
  try {
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return Response.json(
        {
          error: "Square access token is not configured.",
        },
        { status: 500 }
      )
    }

    const authorization = request.headers.get("authorization")

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      )
    }

    const accessToken = authorization.replace("Bearer ", "").trim()

    if (!accessToken) {
      return Response.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return Response.json(
        {
          error: "Authentication failed.",
        },
        { status: 401 }
      )
    }

    if (user.email !== "contact.dootydone@gmail.com") {
      return Response.json(
        {
          error: "Unauthorized.",
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as SaveCardBody

    const customerId = Number(body.customerId)
    const sourceId = String(body.sourceId || "").trim()
    const consentGiven = body.consentGiven === true

    if (!Number.isInteger(customerId) || customerId < 1) {
      return Response.json(
        {
          error: "A valid customer ID is required.",
        },
        { status: 400 }
      )
    }

    if (!sourceId) {
      return Response.json(
        {
          error: "A Square payment token is required.",
        },
        { status: 400 }
      )
    }

    if (!consentGiven) {
      return Response.json(
        {
          error: "Customer permission is required before saving a card.",
        },
        { status: 400 }
      )
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, email, phone, address, zip_code"
      )
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      console.error("Load customer for card error:", customerError)

      return Response.json(
        {
          error: "Customer could not be found.",
        },
        { status: 404 }
      )
    }

    const { data: existingPaymentMethod, error: existingPaymentError } =
      await supabase
        .from("customer_payment_methods")
        .select("id, square_customer_id, square_card_id, status")
        .eq("customer_id", customer.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()

    if (existingPaymentError) {
      console.error(
        "Check existing payment method error:",
        existingPaymentError
      )

      return Response.json(
        {
          error: "We couldn't check the customer's existing payment setup.",
        },
        { status: 500 }
      )
    }

    if (existingPaymentMethod?.square_card_id) {
      return Response.json(
        {
          success: false,
          error: "This customer already has an active card on file.",
        },
        { status: 409 }
      )
    }

    const squareBaseUrl = "https://connect.squareupsandbox.com"

    /*
     * Create a Square customer profile for this Dooty Done customer.
     * We only do this when we don't already have a Square customer
     * stored locally.
     */
    const createCustomerResponse = await fetch(
      `${squareBaseUrl}/v2/customers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Square-Version": "2026-09-16",
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          given_name: customer.first_name,
          family_name: customer.last_name,
          email_address: customer.email || undefined,
          phone_number: customer.phone || undefined,
          reference_id: String(customer.id),
        }),
      }
    )

    const createCustomerBody =
      await createCustomerResponse.json().catch(() => null)

    if (!createCustomerResponse.ok) {
      console.error(
        "Square customer creation failed:",
        createCustomerBody
      )

      return Response.json(
        {
          error:
            createCustomerBody?.errors?.[0]?.detail ||
            "Square customer creation failed.",
        },
        { status: 500 }
      )
    }

    const squareCustomerId = createCustomerBody?.customer?.id

    if (!squareCustomerId) {
      return Response.json(
        {
          error: "Square did not return a customer ID.",
        },
        { status: 500 }
      )
    }

    const createCardResponse = await fetch(
      `${squareBaseUrl}/v2/cards`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Square-Version": "2026-09-16",
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          source_id: sourceId,
          card: {
            customer_id: squareCustomerId,
            reference_id: String(customer.id),
            cardholder_name:
              `${customer.first_name} ${customer.last_name}`.trim(),
            billing_address: {
              address_line_1: customer.address || undefined,
              postal_code: customer.zip_code || undefined,
              country: "US",
            },
          },
        }),
      }
    )

    const createCardBody =
      await createCardResponse.json().catch(() => null)

    if (!createCardResponse.ok) {
      console.error(
        "Square card creation failed:",
        createCardBody
      )

      return Response.json(
        {
          error:
            createCardBody?.errors?.[0]?.detail ||
            "Square could not save the card.",
        },
        { status: 500 }
      )
    }

    const squareCard = createCardBody?.card

    if (!squareCard?.id) {
      return Response.json(
        {
          error: "Square did not return a card ID.",
        },
        { status: 500 }
      )
    }

    const { error: saveDatabaseError } = await supabase
      .from("customer_payment_methods")
      .insert({
        customer_id: customer.id,
        square_customer_id: squareCustomerId,
        square_card_id: squareCard.id,
        card_brand: squareCard.card_brand || null,
        last_4: squareCard.last_4 || null,
        exp_month: squareCard.exp_month || null,
        exp_year: squareCard.exp_year || null,
        status: squareCard.enabled === false ? "disabled" : "active",
      })

    if (saveDatabaseError) {
      console.error(
        "Save payment method database error:",
        saveDatabaseError
      )

      return Response.json(
        {
          error:
            "The card was saved by Square, but we couldn't save its record in Dooty Done.",
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      squareCustomerId,
      squareCard: {
        id: squareCard.id,
        brand: squareCard.card_brand || null,
        last4: squareCard.last_4 || null,
        expMonth: squareCard.exp_month || null,
        expYear: squareCard.exp_year || null,
      },
    })
  } catch (error) {
    console.error("Save Square card unexpected error:", error)

    return Response.json(
      {
        error: "Something went wrong while saving the card.",
      },
      { status: 500 }
    )
  }
}