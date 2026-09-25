import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const resend = new Resend(process.env.RESEND_API_KEY)

// This client is used only to validate the logged-in admin session.
const authSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
)

type NotificationType = "start_trip" | "arrived" | "completed"

type AppointmentNotificationBody = {
  appointmentId?: number
  notificationType?: NotificationType
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

    const authorization = request.headers.get("authorization")

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 }
      )
    }

    const accessToken = authorization.replace("Bearer ", "").trim()

    // Use the authenticated admin's Supabase session for database access.
    // This avoids requiring SUPABASE_SECRET_KEY in local development while
    // still enforcing Supabase Row Level Security.
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
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

    const body = (await request.json()) as AppointmentNotificationBody
    const appointmentId = Number(body.appointmentId)
    const notificationType = body.notificationType

    if (!Number.isInteger(appointmentId) || appointmentId < 1) {
      return Response.json(
        { error: "A valid appointment ID is required." },
        { status: 400 }
      )
    }

    if (
      notificationType !== "start_trip" &&
      notificationType !== "arrived" &&
      notificationType !== "completed"
    ) {
      return Response.json(
        { error: "Invalid notification type." },
        { status: 400 }
      )
    }

    const { data: appointment, error: appointmentError } = await adminSupabase
      .from("appointments")
      .select("id, scheduled_at, appointment_type, status, customer_id")
      .eq("id", appointmentId)
      .single()

    if (appointmentError || !appointment) {
      console.error("Load consultation notification data error:", appointmentError)
      return Response.json(
        { error: "Consultation appointment could not be found." },
        { status: 404 }
      )
    }

    // The existing booking system represents these appointments as a
    // "free quote". Normalize the stored value so minor formatting
    // differences such as "free_quote" or "Free Quote" are also accepted.
    const normalizedAppointmentType = String(
      appointment.appointment_type ?? ""
    )
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")

    const isFreeQuoteConsultation =
      normalizedAppointmentType === "free quote" ||
      normalizedAppointmentType === "consultation"

    if (!isFreeQuoteConsultation) {
      console.error(
        "Unexpected appointment type for consultation notification:",
        appointment.appointment_type
      )

      return Response.json(
        {
          error: "This appointment is not a free quote consultation.",
          appointmentType: appointment.appointment_type,
        },
        { status: 400 }
      )
    }

    const { data: customer, error: customerError } = await adminSupabase
      .from("customers")
      .select("id, first_name, last_name, email, address")
      .eq("id", appointment.customer_id)
      .single()

    if (customerError || !customer) {
      console.error("Load consultation customer data error:", customerError)
      return Response.json(
        { error: "Customer could not be found." },
        { status: 404 }
      )
    }

    if (!customer.email) {
      return Response.json({
        success: false,
        skipped: true,
        reason: "customer_has_no_email",
      })
    }

    const appointmentDateTime = new Date(appointment.scheduled_at).toLocaleString(
      "en-US",
      {
        timeZone: "America/Denver",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    )

    let subject = ""
    let heading = ""
    let message = ""

    if (notificationType === "start_trip") {
      subject = "Dooty Done is on the way 🐾"
      heading = "We're on the way!"
      message = `Hi ${customer.first_name}! Dooty Done is on the way to your home for your free consultation.`
    }

    if (notificationType === "arrived") {
      subject = "Dooty Done has arrived 🐾"
      heading = "We've arrived!"
      message = `Hi ${customer.first_name}! We're at your home for your free consultation and are ready to take a look at the yard.`
    }

    if (notificationType === "completed") {
      subject = "Your Dooty Done consultation is complete 🐾"
      heading = "Consultation complete!"
      message = `Hi ${customer.first_name}! Thanks for meeting with Dooty Done. We'll use what we discussed to prepare your service quote and follow up with you.`
    }

    const { data, error } = await resend.emails.send({
      from: "Dooty Done <contact@dootydone.com>",
      to: [customer.email],
      replyTo: "contact.dootydone@gmail.com",
      subject,
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
            <h1 style="margin: 0; font-size: 28px; color: #678739;">
              ${escapeHtml(heading)}
            </h1>

            <p style="margin: 10px 0 0; color: #5d6870; font-size: 16px;">
              ${escapeHtml(message)}
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
            <h2 style="margin: 0 0 14px; font-size: 18px;">
              Consultation Details
            </h2>

            <p style="margin: 6px 0;">
              <strong>Date & Time:</strong>
              ${escapeHtml(appointmentDateTime)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Address:</strong>
              ${escapeHtml(customer.address)}
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
            <p style="margin: 0;">Dooty Done LLC</p>
            <p style="margin: 4px 0 0;">(719) 425-8838</p>
            <p style="margin: 4px 0 0;">We scoop. You relax.</p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error("Resend consultation notification error:", error)
      return Response.json(
        {
          error: error.message || "Failed to send consultation notification.",
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      id: data?.id ?? null,
    })
  } catch (error) {
    console.error("Consultation notification unexpected error:", error)
    return Response.json(
      { error: "Something went wrong while sending the consultation notification." },
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
