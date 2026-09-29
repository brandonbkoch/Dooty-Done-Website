import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIME_ZONE = "America/Denver"
const JOB_HORIZON_DAYS = 42

type CustomerService = {
  id: number
  service_id: number
  start_date: string
}

type Service = {
  id: number
  frequency: string
  active: boolean
}

type RecurringSchedule = {
  id: number
  customer_service_id: number
  day_of_week: number
  service_time: string
  active: boolean
}

type ExistingJob = {
  recurring_schedule_id: number | null
  scheduled_for: string
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error("Supabase server environment variables are missing.")
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)

  const values: Record<string, string> = {}

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function getDateKeyInTimeZone(date: Date) {
  const parts = getZonedParts(date)

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)

  return {
    year,
    month,
    day,
  }
}

function dateKeyToUtcDate(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day))
}

function utcDateToDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")}`
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return utcDateToDateKey(date)
}

function getDayOfWeek(dateKey: string) {
  return dateKeyToUtcDate(dateKey).getUTCDay()
}

function getTimeZoneOffsetMinutes(utcDate: Date) {
  const parts = getZonedParts(utcDate)

  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return Math.round((asIfUtc - utcDate.getTime()) / 60000)
}

function localDateTimeToUtc(dateKey: string, timeString: string) {
  const { year, month, day } = parseDateKey(dateKey)
  const [hours, minutes] = timeString.slice(0, 5).split(":").map(Number)

  const guess = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
  )

  const firstOffset = getTimeZoneOffsetMinutes(guess)
  let utcDate = new Date(guess.getTime() - firstOffset * 60_000)

  const secondOffset = getTimeZoneOffsetMinutes(utcDate)

  if (secondOffset !== firstOffset) {
    utcDate = new Date(guess.getTime() - secondOffset * 60_000)
  }

  return utcDate
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(
    dateKeyToUtcDate(value).getTime()
  )
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return false
  }

  const authorization = request.headers.get("authorization")
  return authorization === `Bearer ${cronSecret}`
}

async function generateUpcomingJobs() {
  const supabase = getAdminSupabase()

  const now = new Date()
  const todayKey = getDateKeyInTimeZone(now)
  const horizonKey = addDaysToDateKey(todayKey, JOB_HORIZON_DAYS)
  const horizonEndUtc = new Date(`${horizonKey}T23:59:59.999Z`)

  const [
    { data: customerServices, error: customerServicesError },
    { data: recurringSchedules, error: schedulesError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    supabase
      .from("customer_services")
      .select("id, service_id, start_date")
      .eq("status", "active"),
    supabase
      .from("recurring_schedules")
      .select("id, customer_service_id, day_of_week, service_time, active")
      .eq("active", true),
    supabase
      .from("services")
      .select("id, frequency, active")
      .eq("active", true)
      .in("frequency", ["weekly", "biweekly", "twice-weekly"]),
  ])

  if (customerServicesError) {
    throw new Error(
      `Failed to load active customer services: ${customerServicesError.message}`
    )
  }

  if (schedulesError) {
    throw new Error(
      `Failed to load recurring schedules: ${schedulesError.message}`
    )
  }

  if (servicesError) {
    throw new Error(
      `Failed to load recurring services: ${servicesError.message}`
    )
  }

  const activeCustomerServices = (customerServices ||
    []) as CustomerService[]
  const activeSchedules = (recurringSchedules ||
    []) as RecurringSchedule[]
  const activeServices = (services || []) as Service[]

  const customerServiceIds = new Set(
    activeCustomerServices.map((service) => service.id)
  )
  const servicesById = new Map(
    activeServices.map((service) => [service.id, service])
  )
  const customerServicesById = new Map(
    activeCustomerServices.map((service) => [service.id, service])
  )

  const schedulesToGenerate = activeSchedules.filter((schedule) =>
    customerServiceIds.has(schedule.customer_service_id)
  )

  if (schedulesToGenerate.length === 0) {
    return {
      generated: 0,
      activeSchedules: 0,
      horizon: horizonKey,
    }
  }

  const scheduleIds = schedulesToGenerate.map((schedule) => schedule.id)

  const { data: existingJobs, error: existingJobsError } = await supabase
    .from("jobs")
    .select("recurring_schedule_id, scheduled_for")
    .in("recurring_schedule_id", scheduleIds)
    .gte("scheduled_for", now.toISOString())
    .lte("scheduled_for", horizonEndUtc.toISOString())

  if (existingJobsError) {
    throw new Error(
      `Failed to load existing jobs: ${existingJobsError.message}`
    )
  }

  const existingKeys = new Set(
    ((existingJobs || []) as ExistingJob[]).map(
      (job) =>
        `${job.recurring_schedule_id}|${new Date(
          job.scheduled_for
        ).getTime()}`
    )
  )

  const rowsToInsert: Array<{
    customer_service_id: number
    recurring_schedule_id: number
    scheduled_for: string
    status: string
  }> = []

  for (const schedule of schedulesToGenerate) {
    const customerService = customerServicesById.get(
      schedule.customer_service_id
    )

    if (!customerService) {
      continue
    }

    const service = servicesById.get(customerService.service_id)

    if (!service) {
      continue
    }

    const startDateKey = customerService.start_date?.slice(0, 10)

    if (!startDateKey || !isValidDateKey(startDateKey)) {
      console.warn(
        `Skipping recurring schedule ${schedule.id}: invalid service start date.`
      )
      continue
    }

    const frequency = service.frequency
    const scheduleDay = Number(schedule.day_of_week)

    if (
      !Number.isInteger(scheduleDay) ||
      scheduleDay < 0 ||
      scheduleDay > 6 ||
      !schedule.service_time
    ) {
      console.warn(
        `Skipping recurring schedule ${schedule.id}: invalid day or service time.`
      )
      continue
    }

    if (frequency === "weekly" || frequency === "twice-weekly") {
      let cursor = todayKey

      while (cursor <= horizonKey) {
        if (
          cursor >= startDateKey &&
          getDayOfWeek(cursor) === scheduleDay
        ) {
          const scheduledDateTime = localDateTimeToUtc(
            cursor,
            schedule.service_time
          )

          if (scheduledDateTime >= now && scheduledDateTime <= horizonEndUtc) {
            const key = `${schedule.id}|${scheduledDateTime.getTime()}`

            if (!existingKeys.has(key)) {
              rowsToInsert.push({
                customer_service_id: schedule.customer_service_id,
                recurring_schedule_id: schedule.id,
                scheduled_for: scheduledDateTime.toISOString(),
                status: "scheduled",
              })

              existingKeys.add(key)
            }
          }
        }

        cursor = addDaysToDateKey(cursor, 1)
      }

      continue
    }

    if (frequency === "biweekly") {
      const startDay = getDayOfWeek(startDateKey)
      const offset = (scheduleDay - startDay + 7) % 7
      let cursor = addDaysToDateKey(startDateKey, offset)

      while (cursor < todayKey) {
        cursor = addDaysToDateKey(cursor, 14)
      }

      while (cursor <= horizonKey) {
        const scheduledDateTime = localDateTimeToUtc(
          cursor,
          schedule.service_time
        )

        if (scheduledDateTime >= now && scheduledDateTime <= horizonEndUtc) {
          const key = `${schedule.id}|${scheduledDateTime.getTime()}`

          if (!existingKeys.has(key)) {
            rowsToInsert.push({
              customer_service_id: schedule.customer_service_id,
              recurring_schedule_id: schedule.id,
              scheduled_for: scheduledDateTime.toISOString(),
              status: "scheduled",
            })

            existingKeys.add(key)
          }
        }

        cursor = addDaysToDateKey(cursor, 14)
      }
    }
  }

  if (rowsToInsert.length === 0) {
    return {
      generated: 0,
      activeSchedules: schedulesToGenerate.length,
      horizon: horizonKey,
    }
  }

  const { error: insertError } = await supabase
    .from("jobs")
    .insert(rowsToInsert)

  if (insertError) {
    throw new Error(`Failed to insert generated jobs: ${insertError.message}`)
  }

  return {
    generated: rowsToInsert.length,
    activeSchedules: schedulesToGenerate.length,
    horizon: horizonKey,
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const result = await generateUpcomingJobs()

    console.log("Automatic recurring job generation completed:", result)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("Automatic recurring job generation failed:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Automatic recurring job generation failed.",
      },
      { status: 500 }
    )
  }
}
