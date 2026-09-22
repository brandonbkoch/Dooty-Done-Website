import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const resend = new Resend(process.env.RESEND_API_KEY)

type NotificationType = "start_trip" | "arrived" | "completed"

type JobNotificationBody = {
  jobId?: number
  notificationType?: NotificationType
}

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY environment variable")

      return Response.json(
        {
          error: "Email service is not configured.",
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

    /*
     * Create the Supabase client with the customer's/admin's
     * access token attached to every database request.
     */
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
      console.error("Authentication error:", userError)

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

    const body = (await request.json()) as JobNotificationBody

    const jobId = Number(body.jobId)
    const notificationType = body.notificationType

    if (!Number.isInteger(jobId) || jobId < 1) {
      return Response.json(
        {
          error: "A valid job ID is required.",
        },
        { status: 400 }
      )
    }

    if (
      notificationType !== "start_trip" &&
      notificationType !== "arrived" &&
      notificationType !== "completed"
    ) {
      return Response.json(
        {
          error: "Invalid notification type.",
        },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "id, scheduled_for, status, completion_photo_url, customer_service_id"
      )
      .eq("id", jobId)
      .single()

    if (jobError || !job) {
      console.error("Load job notification data error:", jobError)

      return Response.json(
        {
          error: "Job could not be found.",
          details: jobError?.message || null,
        },
        { status: 404 }
      )
    }

    const { data: customerService, error: customerServiceError } =
      await supabase
        .from("customer_services")
        .select("customer_id, service_id, agreed_price")
        .eq("id", job.customer_service_id)
        .single()

    if (customerServiceError || !customerService) {
      console.error(
        "Load customer service notification data error:",
        customerServiceError
      )

      return Response.json(
        {
          error: "Customer service could not be found.",
          details: customerServiceError?.message || null,
        },
        { status: 404 }
      )
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, address")
      .eq("id", customerService.customer_id)
      .single()

    if (customerError || !customer) {
      console.error("Load customer notification data error:", customerError)

      return Response.json(
        {
          error: "Customer could not be found.",
          details: customerError?.message || null,
        },
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

    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", customerService.service_id)
      .single()

    const serviceName = service?.name || "Dooty Done Service"

    const jobDateTime = new Date(job.scheduled_for).toLocaleString("en-US", {
      timeZone: "America/Denver",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

    let subject = ""
    let heading = ""
    let message = ""
    let extraHtml = ""

    if (notificationType === "start_trip") {
      subject = "Dooty Done is on the way 🐾"
      heading = "We're on the way!"
      message = `Hi ${customer.first_name}! Dooty Done is on the way to your home for today's ${serviceName.toLowerCase()}.`
    }

    if (notificationType === "arrived") {
      subject = "Dooty Done has arrived 🐾"
      heading = "We've arrived!"
      message = `Hi ${customer.first_name}! We're at your home and getting ready to take care of the yard.`
    }

    if (notificationType === "completed") {
      subject = "Your Dooty Done service is complete 🐾"
      heading = "Your yard is complete!"
      message = `Hi ${customer.first_name}! Your Dooty Done service has been completed. Thanks for letting us take care of the mess!`

      if (job.completion_photo_url) {
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("job-completion-photos")
            .createSignedUrl(job.completion_photo_url, 60 * 60 * 24 * 7)

        if (signedUrlError) {
          console.error(
            "Create completion photo signed URL error:",
            signedUrlError
          )
        } else if (signedUrlData?.signedUrl) {
          extraHtml = `
            <div style="margin-top: 24px; padding: 20px; background: #F1F5EA; border-radius: 16px;">
              <h2 style="margin: 0 0 10px; font-size: 18px; color: #0A1821;">
                Completion Photo
              </h2>

              <p style="margin: 0 0 14px; color: #5d6870;">
                Here's a photo from today's completed service.
              </p>

              <a
                href="${escapeHtml(signedUrlData.signedUrl)}"
                style="display: inline-block; background: #678739; color: #ffffff; text-decoration: none; font-weight: 800; padding: 12px 18px; border-radius: 999px;"
              >
                View Completion Photo
              </a>

              <p style="margin: 12px 0 0; color: #7a858c; font-size: 12px;">
                This photo link is available for 7 days.
              </p>
            </div>
          `
        }
      }
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
            <h1
              style="
                margin: 0;
                font-size: 28px;
                color: #678739;
              "
            >
              ${escapeHtml(heading)}
            </h1>

            <p
              style="
                margin: 10px 0 0;
                color: #5d6870;
                font-size: 16px;
              "
            >
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
            <h2
              style="
                margin: 0 0 14px;
                font-size: 18px;
              "
            >
              Service Details
            </h2>

            <p style="margin: 6px 0;">
              <strong>Service:</strong>
              ${escapeHtml(serviceName)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Date & Time:</strong>
              ${escapeHtml(jobDateTime)}
            </p>

            <p style="margin: 6px 0;">
              <strong>Address:</strong>
              ${escapeHtml(customer.address)}
            </p>
          </div>

          ${extraHtml}

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
      console.error("Resend job notification error:", error)

      return Response.json(
        {
          error: error.message || "Failed to send customer notification.",
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      id: data?.id ?? null,
    })
  } catch (error) {
    console.error("Job notification unexpected error:", error)

    return Response.json(
      {
        error: "Something went wrong while sending the customer notification.",
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