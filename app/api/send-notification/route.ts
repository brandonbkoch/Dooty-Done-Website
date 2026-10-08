import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

type QuoteNotificationBody = {
  name?: string
  email?: string
  phone?: string
  address?: string
  zipCode?: string
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
    const zipCode = String(body.zipCode || "").trim()
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
      !zipCode ||
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

    const formattedConsultationTime = formatTimeWithAmPm(consultationTime)

    const businessEmail = await resend.emails.send({
      from: "Dooty Done <contact@dootydone.com>",
      to: ["contact.dootydone@gmail.com"],
      replyTo: email,
      subject: `New Free Quote Request — ${name}`,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0A1821; max-width: 680px; margin: 0 auto; padding: 24px;">
          <h1 style="margin: 0 0 8px; color: #678739; font-size: 28px;">
            New Free Quote Request
          </h1>
          <p style="margin: 0 0 24px; color: #5d6870;">
            A new customer submitted a free quote request through the Dooty Done website.
          </p>

          <div style="background: #FEFBF7; border: 1px solid rgba(10, 24, 33, 0.10); border-radius: 16px; padding: 20px;">
            <h2 style="margin: 0 0 14px; font-size: 18px;">Customer Details</h2>
            <p style="margin: 6px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p style="margin: 6px 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p style="margin: 6px 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p style="margin: 6px 0;"><strong>Address:</strong> ${escapeHtml(address)}</p>
            <p style="margin: 6px 0;"><strong>ZIP Code:</strong> ${escapeHtml(zipCode)}</p>
            <p style="margin: 6px 0;"><strong>Number of Dogs:</strong> ${escapeHtml(dogs)}</p>
            <p style="margin: 6px 0;"><strong>Service:</strong> ${escapeHtml(service)}</p>
            <p style="margin: 6px 0;"><strong>Requested Consultation:</strong> ${escapeHtml(consultationDate)} at ${escapeHtml(formattedConsultationTime)}</p>
            <p style="margin: 6px 0;"><strong>Notes:</strong> ${escapeHtml(notes || "None")}</p>
          </div>

          <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid rgba(10, 24, 33, 0.10); color: #5d6870; font-size: 13px;">
            <p style="margin: 0;">Dooty Done LLC</p>
            <p style="margin: 4px 0 0;">(719) 425-8838</p>
            <p style="margin: 4px 0 0;">We scoop. You relax.</p>
          </div>
        </div>
      `,
    })

    if (businessEmail.error) {
      console.error("Resend business quote notification error:", businessEmail.error)
      return Response.json(
        {
          error:
            businessEmail.error.message ||
            "Failed to send business quote notification.",
        },
        { status: 500 }
      )
    }

    const customerEmail = await resend.emails.send({
      from: "Dooty Done <contact@dootydone.com>",
      to: [email],
      replyTo: "contact.dootydone@gmail.com",
      subject: "Your Dooty Done Consultation Is Confirmed 🐾",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0A1821; max-width: 680px; margin: 0 auto; padding: 24px;">
          <div style="margin-bottom: 28px;">
            <h1 style="margin: 0; color: #678739; font-size: 30px;">
              You're booked! 🐾
            </h1>
            <p style="margin: 10px 0 0; color: #5d6870; font-size: 16px;">
              Hi ${escapeHtml(name.split(/\s+/)[0])}! Your free Dooty Done consultation has been successfully scheduled.
            </p>
          </div>

          <div style="background: #FEFBF7; border: 1px solid rgba(10, 24, 33, 0.10); border-radius: 16px; padding: 20px;">
            <h2 style="margin: 0 0 14px; font-size: 18px;">Consultation Details</h2>
            <p style="margin: 6px 0;"><strong>Date:</strong> ${escapeHtml(consultationDate)}</p>
            <p style="margin: 6px 0;"><strong>Time:</strong> ${escapeHtml(formattedConsultationTime)}</p>
            <p style="margin: 6px 0;"><strong>Address:</strong> ${escapeHtml(address)}</p>
            <p style="margin: 6px 0;"><strong>ZIP Code:</strong> ${escapeHtml(zipCode)}</p>
            <p style="margin: 6px 0;"><strong>Number of Dogs:</strong> ${escapeHtml(dogs)}</p>
            <p style="margin: 6px 0;"><strong>Requested Service:</strong> ${escapeHtml(service)}</p>
          </div>

          <div style="margin-top: 24px; padding: 18px; background: #678739; color: #ffffff; border-radius: 16px;">
            <p style="margin: 0; font-weight: 700;">
              What happens next?
            </p>
            <p style="margin: 8px 0 0;">
              We'll meet you at the scheduled consultation, take a look at the yard, and give you a straightforward service quote before recurring service begins.
            </p>
          </div>

          <p style="margin: 24px 0 0; color: #5d6870;">
            Your consultation is free, and there is no obligation to start recurring service.
          </p>

          <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid rgba(10, 24, 33, 0.10); color: #5d6870; font-size: 13px;">
            <p style="margin: 0;">Dooty Done LLC</p>
            <p style="margin: 4px 0 0;">(719) 425-8838</p>
            <p style="margin: 4px 0 0;">contact.dootydone@gmail.com</p>
            <p style="margin: 4px 0 0;">We scoop. You relax.</p>
          </div>
        </div>
      `,
    })

    if (customerEmail.error) {
      console.error("Resend customer confirmation error:", customerEmail.error)
      return Response.json(
        {
          success: true,
          businessNotificationSent: true,
          customerConfirmationSent: false,
          warning:
            customerEmail.error.message ||
            "The business notification was sent, but the customer confirmation email could not be sent.",
        },
        { status: 200 }
      )
    }

    return Response.json({
      success: true,
      businessNotificationSent: true,
      customerConfirmationSent: true,
      businessEmailId: businessEmail.data?.id ?? null,
      customerEmailId: customerEmail.data?.id ?? null,
    })
  } catch (error) {
    console.error("Quote notification unexpected error:", error)
    return Response.json(
      { error: "Something went wrong while sending the quote notifications." },
      { status: 500 }
    )
  }
}

function formatTimeWithAmPm(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

  if (!match) {
    return time
  }

  const hour = Number(match[1])
  const minute = match[2]

  if (hour < 0 || hour > 23) {
    return time
  }

  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minute} ${suffix}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
