import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

type QuoteNotificationBody = {
  name?: string
  email?: string
  phone?: string
  address?: string
  dogs?: string
  service?: string
  consultationDate?: string
  consultationTime?: string
  notes?: string
}

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY environment variable")

      return Response.json(
        { error: "Email service is not configured." },
        { status: 500 }
      )
    }

    const body = (await request.json()) as QuoteNotificationBody

    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim()
    const phone = String(body.phone || "").trim()
    const address = String(body.address || "").trim()
    const dogs = String(body.dogs || "").trim()
    const service = String(body.service || "").trim()
    const consultationDate = String(body.consultationDate || "").trim()
    const consultationTime = String(body.consultationTime || "").trim()
    const notes = String(body.notes || "").trim()

    if (
      !name ||
      !email ||
      !phone ||
      !address ||
      !dogs ||
      !service ||
      !consultationDate ||
      !consultationTime
    ) {
      return Response.json(
        { error: "Missing required quote request information." },
        { status: 400 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: "Dooty Done <contact@dootydone.com>",
      to: ["contact.dootydone@gmail.com"],
      replyTo: email,
      subject: `New Free Quote Request — ${name}`,
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
          <h1
            style="
              margin: 0 0 8px;
              color: #678739;
              font-size: 28px;
            "
          >
            New Free Quote Request
          </h1>

          <p
            style="
              margin: 0 0 24px;
              color: #5d6870;
            "
          >
            A new customer submitted a free quote request through the Dooty Done website.
          </p>

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
              Customer Details
            </h2>

            <p style="margin: 6px 0;">
              <strong>Name:</strong> ${escapeHtml(name)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Email:</strong> ${escapeHtml(email)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Phone:</strong> ${escapeHtml(phone)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Address:</strong> ${escapeHtml(address)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Number of Dogs:</strong> ${escapeHtml(dogs)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Service:</strong> ${escapeHtml(service)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Requested Quote Time:</strong>
              ${escapeHtml(consultationDate)}
              at
              ${escapeHtml(consultationTime)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Notes:</strong>
              ${escapeHtml(notes || "None")}
            </p>
          </div>

          <div
            style="
              margin-top: 28px;
              padding-top: 18px;
              border-top: 1px solid rgba(10, 24, 33, 0.10);
              color: #5d6870;
              font-size: 13px;
            "
          >
            <p style="margin: 0;">
              Dooty Done LLC
            </p>

            <p style="margin: 4px 0 0;">
              (719) 425-8838
            </p>

            <p style="margin: 4px 0 0;">
              We scoop. You relax.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error("Resend quote notification error:", error)

      return Response.json(
        {
          error:
            error.message || "Failed to send quote notification.",
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      id: data?.id ?? null,
    })
  } catch (error) {
    console.error("Quote notification unexpected error:", error)

    return Response.json(
      {
        error:
          "Something went wrong while sending the quote notification.",
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