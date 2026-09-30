import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"

const resend = new Resend(process.env.RESEND_API_KEY)

const authSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
)

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
)

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return Response.json(
        { error: "Email service is not configured." },
        { status: 500 }
      )
    }

    if (!process.env.SUPABASE_SECRET_KEY) {
      return Response.json(
        { error: "Server database access is not configured." },
        { status: 500 }
      )
    }

    const authorization = request.headers.get("authorization")

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const accessToken = authorization.replace("Bearer ", "").trim()

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser(accessToken)

    if (userError || !user) {
      return Response.json(
        { error: "Authentication failed." },
        { status: 401 }
      )
    }

    if (user.email !== "contact.dootydone@gmail.com") {
      return Response.json(
        { error: "Unauthorized." },
        { status: 403 }
      )
    }

    const body = (await request.json()) as {
      customerId?: number
      quoteId?: number
    }

    const customerId = Number(body.customerId)
    const quoteId = Number(body.quoteId)

    if (
      !Number.isInteger(customerId) ||
      customerId < 1 ||
      !Number.isInteger(quoteId) ||
      quoteId < 1
    ) {
      return Response.json(
        { error: "A valid customer and quote are required." },
        { status: 400 }
      )
    }

    const { data: customer, error: customerError } = await adminSupabase
      .from("customers")
      .select("id, first_name, last_name, email")
      .eq("id", customerId)
      .single()

    if (customerError || !customer) {
      console.error("Load customer for payment setup error:", customerError)

      return Response.json(
        { error: "Customer could not be found." },
        { status: 404 }
      )
    }

    if (!customer.email) {
      return Response.json(
        { error: "This customer does not have an email address." },
        { status: 400 }
      )
    }

    const { data: quote, error: quoteError } = await adminSupabase
      .from("quotes")
      .select("id, customer_id, quoted_price, service_frequency, status")
      .eq("id", quoteId)
      .single()

    if (quoteError || !quote) {
      console.error("Load quote for payment setup error:", quoteError)

      return Response.json(
        { error: "Quote could not be found." },
        { status: 404 }
      )
    }

    if (quote.customer_id !== customerId) {
      return Response.json(
        { error: "That quote does not belong to this customer." },
        { status: 400 }
      )
    }

    if (quote.status !== "accepted") {
      return Response.json(
        {
          error:
            "The quote must be accepted before sending the payment setup link.",
        },
        { status: 400 }
      )
    }

    if (
      !["weekly", "biweekly", "twice-weekly"].includes(
        quote.service_frequency || ""
      )
    ) {
      return Response.json(
        { error: "The accepted quote is not a recurring service." },
        { status: 400 }
      )
    }

    const {
      data: existingPaymentMethod,
      error: paymentMethodError,
    } = await adminSupabase
      .from("customer_payment_methods")
      .select("id, status")
      .eq("customer_id", customerId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()

    if (paymentMethodError) {
      console.error(
        "Check existing payment method error:",
        paymentMethodError
      )

      return Response.json(
        { error: "We couldn't check the customer's payment status." },
        { status: 500 }
      )
    }

    if (existingPaymentMethod) {
      return Response.json(
        {
          error:
            "This customer already has an active payment card on file.",
        },
        { status: 409 }
      )
    }

    // Invalidate any older unused setup links for this same quote.
    const { error: invalidateError } = await adminSupabase
      .from("customer_setup_tokens")
      .update({
        used_at: new Date().toISOString(),
      })
      .eq("customer_id", customerId)
      .eq("quote_id", quoteId)
      .is("used_at", null)

    if (invalidateError) {
      console.error(
        "Invalidate old setup links error:",
        invalidateError
      )

      return Response.json(
        {
          error:
            "We couldn't prepare a new secure payment setup link.",
        },
        { status: 500 }
      )
    }

    const token = randomBytes(32).toString("hex")

    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString()

    const { error: insertError } = await adminSupabase
      .from("customer_setup_tokens")
      .insert({
        customer_id: customerId,
        quote_id: quoteId,
        token,
        expires_at: expiresAt,
        used_at: null,
      })

    if (insertError) {
      console.error(
        "Create payment setup token error:",
        insertError
      )

      return Response.json(
        {
          error:
            "We couldn't create the secure payment setup link.",
        },
        { status: 500 }
      )
    }

    const setupUrl =
      `https://dootydone.com/setup?token=` +
      encodeURIComponent(token)

    const frequencyLabel =
      quote.service_frequency === "weekly"
        ? "Weekly"
        : quote.service_frequency === "biweekly"
          ? "Bi-Weekly"
          : "Twice Weekly"

    const priceText =
      quote.quoted_price !== null &&
      quote.quoted_price !== undefined
        ? `$${Number(quote.quoted_price).toFixed(2)} per visit`
        : "your agreed recurring service price"

    const { data, error: emailError } =
      await resend.emails.send({
        from: "Dooty Done <contact@dootydone.com>",
        to: [customer.email],
        replyTo: "contact.dootydone@gmail.com",
        subject:
          "Set up your Dooty Done payment method 🐾",
        html: `
          <div
            style="
              font-family: Arial, Helvetica, sans-serif;
              line-height: 1.6;
              color: #0A1821;
              max-width: 680px;
              margin: 0 auto;
              padding: 24px;
            "
          >
            <div style="margin-bottom: 28px;">
              <h1
                style="
                  margin: 0;
                  font-size: 28px;
                  color: #678739;
                "
              >
                Welcome to Dooty Done!
              </h1>

              <p
                style="
                  margin: 10px 0 0;
                  color: #5d6870;
                  font-size: 16px;
                "
              >
                Hi ${escapeHtml(customer.first_name)},
                your recurring service is ready to get set up.
              </p>
            </div>

            <div
              style="
                background: #FEFBF7;
                border: 1px solid rgba(10, 24, 33, 0.10);
                border-radius: 16px;
                padding: 20px;
              "
            >
              <h2
                style="
                  margin: 0 0 14px;
                  font-size: 18px;
                "
              >
                Payment Setup
              </h2>

              <p style="margin: 6px 0;">
                <strong>Service:</strong>
                ${escapeHtml(frequencyLabel)} scooping
              </p>

              <p style="margin: 6px 0;">
                <strong>Price:</strong>
                ${escapeHtml(priceText)}
              </p>

              <p
                style="
                  margin: 16px 0 0;
                  color: #5d6870;
                "
              >
                Please use the secure link below to save
                your card on file. Your card will only be
                charged after completed recurring services.
              </p>

              <div style="margin-top: 22px;">
                <a
                  href="${setupUrl}"
                  style="
                    display: inline-block;
                    background: #678739;
                    color: #ffffff;
                    text-decoration: none;
                    font-weight: 800;
                    border-radius: 999px;
                    padding: 13px 22px;
                  "
                >
                  Securely Set Up Payment
                </a>
              </div>

              <p
                style="
                  margin: 18px 0 0;
                  color: #5d6870;
                  font-size: 13px;
                "
              >
                This secure link expires in 24 hours.
                If you need a new link, please contact
                Dooty Done.
              </p>
            </div>

            <div
              style="
                margin-top: 28px;
                padding-top: 18px;
                border-top:
                  1px solid rgba(10, 24, 33, 0.10);
                color: #5d6870;
                font-size: 13px;
              "
            >
              <p style="margin: 0;">
                Dooty Done LLC
              </p>

              <p style="margin: 4px 0 0;">
                contact.dootydone@gmail.com
              </p>

              <p style="margin: 4px 0 0;">
                We scoop. You relax.
              </p>
            </div>
          </div>
        `,
      })

    if (emailError) {
      console.error(
        "Payment setup email error:",
        emailError
      )

      // The token is no longer usable if the email
      // could not be sent.
      await adminSupabase
        .from("customer_setup_tokens")
        .update({
          used_at: new Date().toISOString(),
        })
        .eq("token", token)

      return Response.json(
        {
          error:
            emailError.message ||
            "Failed to send payment setup email.",
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      email: customer.email,
      expiresAt,
      id: data?.id ?? null,
    })
  } catch (error) {
    console.error(
      "Payment setup link unexpected error:",
      error
    )

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while sending the payment setup link.",
      },
      { status: 500 }
    )
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}