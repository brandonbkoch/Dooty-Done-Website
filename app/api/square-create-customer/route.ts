import { SquareClient, SquareEnvironment, SquareError } from "square"
import { createClient } from "@supabase/supabase-js"

type CreateCustomerBody = {
  customerId?: number
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

    const body = (await request.json()) as CreateCustomerBody
    const customerId = Number(body.customerId)

    if (!Number.isInteger(customerId) || customerId < 1) {
      return Response.json(
        {
          error: "A valid customer ID is required.",
        },
        { status: 400 }
      )
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, address, zip_code")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      console.error("Load customer error:", customerError)

      return Response.json(
        {
          error: "Customer could not be found.",
        },
        { status: 404 }
      )
    }

    const { data: existingPaymentMethod, error: existingError } =
      await supabase
        .from("customer_payment_methods")
        .select("id, square_customer_id, square_card_id, status")
        .eq("customer_id", customer.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()

    if (existingError) {
      console.error(
        "Check existing payment method error:",
        existingError
      )

      return Response.json(
        {
          error: "We couldn't check the customer's existing payment setup.",
        },
        { status: 500 }
      )
    }

    if (existingPaymentMethod?.square_customer_id) {
      return Response.json({
        success: true,
        alreadyExists: true,
        squareCustomerId: existingPaymentMethod.square_customer_id,
      })
    }

    const square = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: SquareEnvironment.Sandbox,
    })

    const response = await square.customers.create({
      givenName: customer.first_name,
      familyName: customer.last_name,
      emailAddress: customer.email || undefined,
      phoneNumber: customer.phone || undefined,
      referenceId: String(customer.id),
    })

    const squareCustomer = response.customer

    if (!squareCustomer?.id) {
      console.error("Square customer creation returned no customer ID.")

      return Response.json(
        {
          error: "Square did not return a customer ID.",
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      alreadyExists: false,
      squareCustomerId: squareCustomer.id,
    })
  } catch (error) {
    if (error instanceof SquareError) {
      console.error("Square customer creation error:", error)

      return Response.json(
        {
          error: error.message,
          squareErrors: error.errors,
        },
        { status: 500 }
      )
    }

    console.error("Unexpected Square customer creation error:", error)

    return Response.json(
      {
        error: "Unexpected error creating the Square customer.",
      },
      { status: 500 }
    )
  }
}