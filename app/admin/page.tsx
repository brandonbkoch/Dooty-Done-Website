"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

type Customer = {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string | null
  address: string
  zip_code: string
  number_of_dogs: number | null
  service_frequency: string | null
  recurring_price: number | null
  status: string
  notes: string | null
  customer_since?: string | null
}

type Appointment = {
  id: number
  customer_id: number
  scheduled_at: string
  appointment_type: string
  status: string
  cleanup_completed: boolean
  free_cleanup_applied: boolean
  notes: string | null
  customer: Customer[]
}

type AvailabilitySlot = {
  id: number
  available_date: string
  available_time: string
  appointment_type: string
  is_available: boolean
}

type Quote = {
  id: number
  customer_id: number
  appointment_id: number
  quoted_price: number | null
  service_frequency: string | null
  status: string
  quoted_at: string | null
  accepted_at: string | null
  notes: string | null
}

type Service = {
  id: number
  name: string
  description: string | null
  frequency: string
  base_price: number
  active: boolean
}

type CustomerService = {
  id: number
  customer_id: number
  service_id: number
  agreed_price: number
  start_date: string
  status: string
  notes: string | null
}

type RecurringSchedule = {
  id: number
  customer_service_id: number
  day_of_week: number
  service_time: string
  active: boolean
  notes: string | null
}

type Job = {
  id: number
  customer_service_id: number
  recurring_schedule_id: number | null
  scheduled_for: string
  status: string
  departed_at: string | null
  arrived_at: string | null
  completed_at: string | null
  completion_photo_url: string | null
  gate_closed: boolean
  notes: string | null
}

export default function AdminDashboard() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [customerServices, setCustomerServices] = useState<CustomerService[]>([])
  const [errorMessage, setErrorMessage] = useState("")

  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [availabilityBusy, setAvailabilityBusy] = useState(false)

  const [quoteCustomerId, setQuoteCustomerId] = useState("")
  const [quoteAppointmentId, setQuoteAppointmentId] = useState("")
  const [quotePrice, setQuotePrice] = useState("")
  const [quoteFrequency, setQuoteFrequency] = useState("")
  const [quoteStatus, setQuoteStatus] = useState("pending")
  const [quoteNotes, setQuoteNotes] = useState("")
  const [quoteBusy, setQuoteBusy] = useState(false)

  const [recurringCustomerId, setRecurringCustomerId] = useState("")
  const [recurringServiceId, setRecurringServiceId] = useState("")
  const [recurringPrice, setRecurringPrice] = useState("")
  const [recurringStartDate, setRecurringStartDate] = useState("")
  const [recurringStatus, setRecurringStatus] = useState("active")
  const [recurringNotes, setRecurringNotes] = useState("")
  const [recurringBusy, setRecurringBusy] = useState(false)

  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([])
  const [scheduleCustomerServiceId, setScheduleCustomerServiceId] = useState("")
  const [scheduleDay, setScheduleDay] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [scheduleNotes, setScheduleNotes] = useState("")
  const [scheduleBusy, setScheduleBusy] = useState(false)

  const [jobs, setJobs] = useState<Job[]>([])
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<"week" | "month">("week")
  const [jobsBusy, setJobsBusy] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [jobActionBusy, setJobActionBusy] = useState(false)
  const [completionPhoto, setCompletionPhoto] = useState<File | null>(null)
  const [completionGateClosed, setCompletionGateClosed] = useState(false)

  const loadDashboard = async () => {
    setLoading(true)
    setErrorMessage("")

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace("/admin/login")
      return
    }

    if (user.email !== "contact.dootydone@gmail.com") {
      await supabase.auth.signOut()
      router.replace("/admin/login")
      return
    }

    setUserEmail(user.email)

    const [
      { data: customerData, error: customerError },
      { data: appointmentData, error: appointmentError },
      { data: availabilityData, error: availabilityError },
      { data: quoteData, error: quoteError },
      { data: serviceData, error: serviceError },
      { data: customerServiceData, error: customerServiceError },
      { data: recurringScheduleData, error: recurringScheduleError },
      { data: jobData, error: jobError },
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .order("id", { ascending: false })
        .limit(10),

      supabase
        .from("appointments")
        .select(`
          id,
          customer_id,
          scheduled_at,
          appointment_type,
          status,
          cleanup_completed,
          free_cleanup_applied,
          notes,
          customer:customers (
            id,
            first_name,
            last_name,
            phone,
            email,
            address,
            zip_code,
            number_of_dogs,
            service_frequency,
            recurring_price,
            status,
            notes,
            customer_since
          )
        `)
        .order("scheduled_at", { ascending: true })
        .limit(100),

      supabase
        .from("availability")
        .select("*")
        .eq("is_available", true)
        .eq("appointment_type", "consultation")
        .order("available_date", { ascending: true })
        .order("available_time", { ascending: true })
        .limit(20),

      supabase
        .from("quotes")
        .select("*")
        .order("id", { ascending: false })
        .limit(20),

      supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("id", { ascending: true }),

      supabase
        .from("customer_services")
        .select("*")
        .order("id", { ascending: false })
        .limit(50),

      supabase
        .from("recurring_schedules")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("service_time", { ascending: true }),

      supabase
        .from("jobs")
        .select("*")
        .gte("scheduled_for", startOfLocalDay(new Date()).toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(100),
    ])

    if (
      customerError ||
      appointmentError ||
      availabilityError ||
      quoteError ||
      serviceError ||
      customerServiceError ||
      recurringScheduleError ||
      jobError
    ) {
      console.error("Dashboard loading error:", {
        customerError,
        appointmentError,
        availabilityError,
        quoteError,
        serviceError,
        customerServiceError,
        recurringScheduleError,
        jobError,
      })

      setErrorMessage(
        "We couldn't load some dashboard information. Please refresh and try again."
      )
    }

    setCustomers((customerData || []) as Customer[])
    setAppointments((appointmentData || []) as unknown as Appointment[])
    setAvailability((availabilityData || []) as AvailabilitySlot[])
    setQuotes((quoteData || []) as Quote[])
    setServices((serviceData || []) as Service[])
    setCustomerServices((customerServiceData || []) as CustomerService[])
    setRecurringSchedules((recurringScheduleData || []) as RecurringSchedule[])
    setJobs((jobData || []) as Job[])
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/admin/login")
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatAvailabilityDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number)

    return new Date(year, month - 1, day).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatAvailabilityTime = (timeString: string) => {
    const [hours, minutes] = timeString.slice(0, 5).split(":").map(Number)

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatFrequency = (frequency: string | null) => {
    switch (frequency) {
      case "weekly":
        return "Weekly"
      case "biweekly":
        return "Every Other Week"
      case "twice-weekly":
        return "Twice Weekly"
      case "one-time":
        return "One-Time Cleanup"
      default:
        return frequency || "—"
    }
  }

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      new Date(appointment.scheduled_at).getTime() >= Date.now()
  )

  const recurringServicesOnly = services.filter(
    (service) =>
      service.active &&
      ["weekly", "biweekly", "twice-weekly"].includes(service.frequency)
  )

  const acceptedRecurringCustomerIds = new Set(
    quotes
      .filter(
        (quote) =>
          quote.status === "accepted" &&
          ["weekly", "biweekly", "twice-weekly"].includes(
            quote.service_frequency || ""
          )
      )
      .map((quote) => quote.customer_id)
  )

  const acceptedRecurringCustomers = customers.filter((customer) =>
    acceptedRecurringCustomerIds.has(customer.id)
  )

  const handleAddAvailability = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!newDate || !newTime) {
      setErrorMessage("Please choose a date and time.")
      return
    }

    setAvailabilityBusy(true)
    setErrorMessage("")

    const { error } = await supabase.from("availability").insert({
      available_date: newDate,
      available_time: newTime,
      appointment_type: "consultation",
      is_available: true,
    })

    if (error) {
      console.error("Add availability error:", error)

      if (error.code === "23505") {
        setErrorMessage("That consultation slot already exists.")
      } else {
        setErrorMessage(
          "We couldn't add that consultation slot. Please try again."
        )
      }

      setAvailabilityBusy(false)
      return
    }

    setNewDate("")
    setNewTime("")
    await loadDashboard()
    setAvailabilityBusy(false)
  }

  const handleRemoveAvailability = async (slotId: number) => {
    const confirmed = window.confirm(
      "Remove this consultation slot? Customers will no longer be able to book it."
    )

    if (!confirmed) return

    setAvailabilityBusy(true)
    setErrorMessage("")

    const { error } = await supabase
      .from("availability")
      .delete()
      .eq("id", slotId)

    if (error) {
      console.error("Remove availability error:", error)
      setErrorMessage(
        "We couldn't remove that consultation slot. Please try again."
      )
      setAvailabilityBusy(false)
      return
    }

    await loadDashboard()
    setAvailabilityBusy(false)
  }

  const handleCustomerSelection = (customerId: string) => {
    setQuoteCustomerId(customerId)
    setQuoteAppointmentId("")
    setQuotePrice("")
    setQuoteFrequency("")
    setQuoteStatus("pending")
    setQuoteNotes("")

    const customerAppointments = appointments.filter(
      (appointment) => appointment.customer_id === Number(customerId)
    )

    const latestAppointment = customerAppointments[0]

    if (latestAppointment) {
      setQuoteAppointmentId(String(latestAppointment.id))
    }

    const existingQuote = quotes.find(
      (quote) =>
        quote.customer_id === Number(customerId) &&
        latestAppointment &&
        quote.appointment_id === latestAppointment.id
    )

    if (existingQuote) {
      setQuotePrice(
        existingQuote.quoted_price !== null
          ? String(existingQuote.quoted_price)
          : ""
      )
      setQuoteFrequency(existingQuote.service_frequency || "")
      setQuoteStatus(existingQuote.status || "pending")
      setQuoteNotes(existingQuote.notes || "")
      setQuoteAppointmentId(String(existingQuote.appointment_id))
    }
  }

  const handleAppointmentSelection = (appointmentId: string) => {
    setQuoteAppointmentId(appointmentId)

    const existingQuote = quotes.find(
      (quote) => quote.appointment_id === Number(appointmentId)
    )

    if (existingQuote) {
      setQuotePrice(
        existingQuote.quoted_price !== null
          ? String(existingQuote.quoted_price)
          : ""
      )
      setQuoteFrequency(existingQuote.service_frequency || "")
      setQuoteStatus(existingQuote.status || "pending")
      setQuoteNotes(existingQuote.notes || "")
    } else {
      setQuotePrice("")
      setQuoteFrequency("")
      setQuoteStatus("pending")
      setQuoteNotes("")
    }
  }

  const handleSaveQuote = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!quoteCustomerId || !quoteAppointmentId || !quotePrice) {
      setErrorMessage(
        "Please choose a customer, consultation, and quoted price."
      )
      return
    }

    const price = Number(quotePrice)

    if (!Number.isFinite(price) || price < 0) {
      setErrorMessage("Please enter a valid quoted price.")
      return
    }

    setQuoteBusy(true)
    setErrorMessage("")

    const existingQuote = quotes.find(
      (quote) => quote.appointment_id === Number(quoteAppointmentId)
    )

    const payload = {
      customer_id: Number(quoteCustomerId),
      appointment_id: Number(quoteAppointmentId),
      quoted_price: price,
      service_frequency: quoteFrequency || null,
      status: quoteStatus,
      quoted_at: existingQuote?.quoted_at || new Date().toISOString(),
      accepted_at:
        quoteStatus === "accepted"
          ? existingQuote?.accepted_at || new Date().toISOString()
          : null,
      notes: quoteNotes || null,
    }

    const { error } = existingQuote
      ? await supabase
          .from("quotes")
          .update(payload)
          .eq("id", existingQuote.id)
      : await supabase.from("quotes").insert(payload)

    if (error) {
      console.error("Save quote error:", error)
      setErrorMessage(
        "We couldn't save that quote. Please check the information and try again."
      )
      setQuoteBusy(false)
      return
    }

    await loadDashboard()
    setQuoteBusy(false)

    alert(
      quoteStatus === "accepted"
        ? "Quote saved and marked accepted."
        : "Quote saved successfully."
    )
  }

  const handleQuoteStatusChange = async (
    quote: Quote,
    newStatus: string
  ) => {
    setQuoteBusy(true)
    setErrorMessage("")

    const acceptedAt =
      newStatus === "accepted"
        ? quote.accepted_at || new Date().toISOString()
        : null

    const { error } = await supabase
      .from("quotes")
      .update({
        status: newStatus,
        accepted_at: acceptedAt,
      })
      .eq("id", quote.id)

    if (error) {
      console.error("Update quote status error:", error)
      setErrorMessage("We couldn't update that quote status. Please try again.")
      setQuoteBusy(false)
      return
    }

    await loadDashboard()
    setQuoteBusy(false)
  }

  const handleRecurringCustomerSelection = (customerId: string) => {
    setRecurringCustomerId(customerId)

    const acceptedQuote = quotes.find(
      (quote) =>
        quote.customer_id === Number(customerId) &&
        quote.status === "accepted" &&
        ["weekly", "biweekly", "twice-weekly"].includes(
          quote.service_frequency || ""
        )
    )

    if (!acceptedQuote) {
      setRecurringServiceId("")
      setRecurringPrice("")
      return
    }

    const matchingService = recurringServicesOnly.find(
      (service) => service.frequency === acceptedQuote.service_frequency
    )

    if (matchingService) {
      setRecurringServiceId(String(matchingService.id))
    } else {
      setRecurringServiceId("")
    }

    setRecurringPrice(
      acceptedQuote.quoted_price !== null
        ? String(acceptedQuote.quoted_price)
        : ""
    )

    const existingService = customerServices.find(
      (service) =>
        service.customer_id === Number(customerId) &&
        service.status === "active"
    )

    if (existingService) {
      setRecurringServiceId(String(existingService.service_id))
      setRecurringPrice(String(existingService.agreed_price))
      setRecurringStartDate(existingService.start_date || "")
      setRecurringStatus(existingService.status || "active")
      setRecurringNotes(existingService.notes || "")
    }
  }

  const handleRecurringServiceSelection = (serviceId: string) => {
    setRecurringServiceId(serviceId)

    const selectedService = recurringServicesOnly.find(
      (service) => service.id === Number(serviceId)
    )

    if (!selectedService) return

    const selectedCustomer = customers.find(
      (customer) => customer.id === Number(recurringCustomerId)
    )

    const acceptedQuote = quotes.find(
      (quote) =>
        quote.customer_id === selectedCustomer?.id &&
        quote.status === "accepted" &&
        quote.service_frequency === selectedService.frequency
    )

    if (acceptedQuote?.quoted_price !== null && acceptedQuote?.quoted_price !== undefined) {
      setRecurringPrice(String(acceptedQuote.quoted_price))
    } else {
      setRecurringPrice(String(selectedService.base_price))
    }
  }

  const handleSaveRecurringService = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (
      !recurringCustomerId ||
      !recurringServiceId ||
      !recurringPrice ||
      !recurringStartDate
    ) {
      setErrorMessage(
        "Please choose a customer, service, agreed price, and start date."
      )
      return
    }

    const price = Number(recurringPrice)

    if (!Number.isFinite(price) || price < 0) {
      setErrorMessage("Please enter a valid recurring price.")
      return
    }

    const selectedCustomer = customers.find(
      (customer) => customer.id === Number(recurringCustomerId)
    )

    const selectedService = recurringServicesOnly.find(
      (service) => service.id === Number(recurringServiceId)
    )

    if (!selectedCustomer || !selectedService) {
      setErrorMessage("Please select a valid customer and recurring service.")
      return
    }

    const hasAcceptedQuote = quotes.some(
      (quote) =>
        quote.customer_id === selectedCustomer.id &&
        quote.status === "accepted" &&
        quote.service_frequency === selectedService.frequency
    )

    if (!hasAcceptedQuote) {
      setErrorMessage(
        "This customer must have an accepted quote for the selected recurring service before setup."
      )
      return
    }

    setRecurringBusy(true)
    setErrorMessage("")

    const { data: activeServices, error: activeServiceError } = await supabase
      .from("customer_services")
      .select("*")
      .eq("customer_id", selectedCustomer.id)
      .eq("status", "active")
      .order("id", { ascending: false })
      .limit(1)

    if (activeServiceError) {
      console.error("Check existing recurring service error:", activeServiceError)
      setErrorMessage(
        "We couldn't check the customer's existing recurring service."
      )
      setRecurringBusy(false)
      return
    }

    const existingActiveService = activeServices?.[0]

    let serviceError = null

    if (existingActiveService) {
      const { error } = await supabase
        .from("customer_services")
        .update({
          service_id: selectedService.id,
          agreed_price: price,
          start_date: recurringStartDate,
          status: recurringStatus,
          notes: recurringNotes || null,
        })
        .eq("id", existingActiveService.id)

      serviceError = error
    } else {
      const { error } = await supabase.from("customer_services").insert({
        customer_id: selectedCustomer.id,
        service_id: selectedService.id,
        agreed_price: price,
        start_date: recurringStartDate,
        status: recurringStatus,
        notes: recurringNotes || null,
      })

      serviceError = error
    }

    if (serviceError) {
      console.error("Save recurring service error:", serviceError)
      setErrorMessage(
        "We couldn't save the recurring service. Please try again."
      )
      setRecurringBusy(false)
      return
    }

    const customerUpdate = await supabase
      .from("customers")
      .update({
        service_frequency: selectedService.frequency,
        recurring_price: price,
        status: recurringStatus === "active" ? "active" : recurringStatus,
        customer_since:
          recurringStatus === "active" ? recurringStartDate : null,
      })
      .eq("id", selectedCustomer.id)

    if (customerUpdate.error) {
      console.error("Update customer recurring info error:", customerUpdate.error)
      setErrorMessage(
        "The recurring service was saved, but the customer record could not be updated."
      )
      setRecurringBusy(false)
      await loadDashboard()
      return
    }

    await loadDashboard()

    setRecurringBusy(false)

    alert("Recurring service saved successfully.")
  }

  const handleStopService = async (customerService: CustomerService) => {
    const customer = customers.find(
      (item) => item.id === customerService.customer_id
    )

    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : "this customer"

    const confirmed = window.confirm(
      `Stop recurring service for ${customerName}? This will stop their recurring schedule and cancel future jobs, but it will keep their customer and completed-job history.`
    )

    if (!confirmed) return

    setRecurringBusy(true)
    setErrorMessage("")

    const { error: serviceError } = await supabase
      .from("customer_services")
      .update({ status: "cancelled" })
      .eq("id", customerService.id)

    if (serviceError) {
      console.error("Stop service error:", serviceError)
      setErrorMessage("We couldn't stop that recurring service. Please try again.")
      setRecurringBusy(false)
      return
    }

    const { error: scheduleError } = await supabase
      .from("recurring_schedules")
      .update({ active: false })
      .eq("customer_service_id", customerService.id)

    if (scheduleError) {
      console.error("Stop recurring schedule error:", scheduleError)
      setErrorMessage(
        "The recurring service was cancelled, but the schedule could not be deactivated."
      )
      setRecurringBusy(false)
      await loadDashboard()
      return
    }

    const { error: jobError } = await supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("customer_service_id", customerService.id)
      .gte("scheduled_for", new Date().toISOString())
      .in("status", ["scheduled", "on_the_way", "arrived", "in_progress"])

    if (jobError) {
      console.error("Cancel future jobs error:", jobError)
      setErrorMessage(
        "The service and schedule were stopped, but some future jobs could not be cancelled."
      )
      setRecurringBusy(false)
      await loadDashboard()
      return
    }

    const { error: customerError } = await supabase
      .from("customers")
      .update({
        status: "cancelled",
        service_frequency: null,
        recurring_price: null,
      })
      .eq("id", customerService.customer_id)

    if (customerError) {
      console.error("Update cancelled customer error:", customerError)
      setErrorMessage(
        "The recurring service was stopped, but the customer record could not be fully updated."
      )
      setRecurringBusy(false)
      await loadDashboard()
      return
    }

    await loadDashboard()
    setRecurringBusy(false)

    alert(
      `${customerName}'s recurring service has been stopped. Future jobs are cancelled and service history was kept.`
    )
  }

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]

  const activeRecurringCustomerServices = customerServices.filter(
    (customerService) =>
      customerService.status === "active" &&
      recurringServicesOnly.some(
        (service) => service.id === customerService.service_id
      )
  )

  const formatServiceTime = (timeString: string) => {
    return formatAvailabilityTime(timeString)
  }

  const formatScheduleDay = (dayOfWeek: number) => {
    return dayNames[dayOfWeek] || "Unknown day"
  }

  const getCustomerNameForService = (customerServiceId: number) => {
    const customerService = customerServices.find(
      (item) => item.id === customerServiceId
    )

    if (!customerService) return "Customer"

    const customer = customers.find(
      (item) => item.id === customerService.customer_id
    )

    return customer
      ? `${customer.first_name} ${customer.last_name}`
      : "Customer"
  }

  const getServiceNameForCustomerService = (customerServiceId: number) => {
    const customerService = customerServices.find(
      (item) => item.id === customerServiceId
    )

    if (!customerService) return "Recurring Service"

    const service = services.find(
      (item) => item.id === customerService.service_id
    )

    return service?.name || "Recurring Service"
  }

  const handleScheduleCustomerSelection = (customerServiceId: string) => {
    setScheduleCustomerServiceId(customerServiceId)

    const selectedCustomerService = activeRecurringCustomerServices.find(
      (item) => item.id === Number(customerServiceId)
    )

    if (!selectedCustomerService) return

    const existing = recurringSchedules.filter(
      (schedule) =>
        schedule.customer_service_id === selectedCustomerService.id &&
        schedule.active
    )

    if (existing.length > 0) {
      setScheduleDay(String(existing[0].day_of_week))
      setScheduleTime(existing[0].service_time.slice(0, 5))
      setScheduleNotes(existing[0].notes || "")
    } else {
      setScheduleDay("")
      setScheduleTime("")
      setScheduleNotes("")
    }
  }

  const handleSaveRecurringSchedule = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!scheduleCustomerServiceId || !scheduleDay || !scheduleTime) {
      setErrorMessage(
        "Please choose a recurring customer, service day, and service time."
      )
      return
    }

    const customerServiceId = Number(scheduleCustomerServiceId)
    const selectedCustomerService = activeRecurringCustomerServices.find(
      (item) => item.id === customerServiceId
    )

    if (!selectedCustomerService) {
      setErrorMessage("Please select a valid active recurring service.")
      return
    }

    const selectedService = recurringServicesOnly.find(
      (service) => service.id === selectedCustomerService.service_id
    )

    if (!selectedService) {
      setErrorMessage("We couldn't identify this customer's recurring service.")
      return
    }

    const existingActiveSchedules = recurringSchedules.filter(
      (schedule) =>
        schedule.customer_service_id === customerServiceId &&
        schedule.active
    )

    const maximumSchedules =
      selectedService.frequency === "twice-weekly" ? 2 : 1

    const isDuplicate = existingActiveSchedules.some(
      (schedule) =>
        schedule.day_of_week === Number(scheduleDay) &&
        schedule.service_time.slice(0, 5) === scheduleTime
    )

    if (isDuplicate) {
      setErrorMessage("That customer is already scheduled for that day and time.")
      return
    }

    if (existingActiveSchedules.length >= maximumSchedules) {
      setErrorMessage(
        selectedService.frequency === "twice-weekly"
          ? "Twice-weekly customers can have up to two scheduled service times."
          : "This recurring service already has a scheduled service time."
      )
      return
    }

    setScheduleBusy(true)
    setErrorMessage("")

    const { error } = await supabase.from("recurring_schedules").insert({
      customer_service_id: customerServiceId,
      day_of_week: Number(scheduleDay),
      service_time: scheduleTime,
      active: true,
      notes: scheduleNotes || null,
    })

    if (error) {
      console.error("Save recurring schedule error:", error)

      if (error.code === "23505") {
        setErrorMessage("That recurring schedule already exists.")
      } else {
        setErrorMessage(
          "We couldn't save the recurring schedule. Please try again."
        )
      }

      setScheduleBusy(false)
      return
    }

    setScheduleDay("")
    setScheduleTime("")
    setScheduleNotes("")
    await loadDashboard()
    setScheduleBusy(false)

    alert("Recurring schedule saved successfully.")
  }

  const handleRemoveRecurringSchedule = async (scheduleId: number) => {
    const confirmed = window.confirm(
      "Remove this recurring schedule? Future jobs will no longer use this schedule."
    )

    if (!confirmed) return

    setScheduleBusy(true)
    setErrorMessage("")

    const { error } = await supabase
      .from("recurring_schedules")
      .delete()
      .eq("id", scheduleId)

    if (error) {
      console.error("Remove recurring schedule error:", error)
      setErrorMessage(
        "We couldn't remove that recurring schedule. Please try again."
      )
      setScheduleBusy(false)
      return
    }

    await loadDashboard()
    setScheduleBusy(false)
  }

  const formatJobDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const startOfLocalDay = (date: Date) => {
    const result = new Date(date)
    result.setHours(0, 0, 0, 0)
    return result
  }

  const buildLocalDateTime = (date: Date, timeString: string) => {
    const result = new Date(date)
    const [hours, minutes] = timeString.slice(0, 5).split(":").map(Number)
    result.setHours(hours, minutes, 0, 0)
    return result
  }

  const handleGenerateUpcomingJobs = async () => {
    setJobsBusy(true)
    setErrorMessage("")

    try {
      const activeSchedules = recurringSchedules.filter((schedule) => schedule.active)
      const activeServiceIds = new Set(
        customerServices
          .filter((service) => service.status === "active")
          .map((service) => service.id)
      )

      const schedulesToGenerate = activeSchedules.filter((schedule) =>
        activeServiceIds.has(schedule.customer_service_id)
      )

      if (schedulesToGenerate.length === 0) {
        setErrorMessage(
          "There are no active recurring schedules to turn into jobs yet."
        )
        setJobsBusy(false)
        return
      }

      const horizon = new Date()
      horizon.setDate(horizon.getDate() + 42)

      const scheduleIds = schedulesToGenerate.map((schedule) => schedule.id)
      const { data: existingJobData, error: existingJobError } = await supabase
        .from("jobs")
        .select("id, recurring_schedule_id, scheduled_for")
        .in("recurring_schedule_id", scheduleIds)
        .gte("scheduled_for", startOfLocalDay(new Date()).toISOString())
        .lte("scheduled_for", horizon.toISOString())

      if (existingJobError) {
        console.error("Load existing jobs error:", existingJobError)
        setErrorMessage("We couldn't check existing jobs. Please try again.")
        setJobsBusy(false)
        return
      }

      const existingKeys = new Set(
        (existingJobData || []).map(
          (job) => `${job.recurring_schedule_id}|${new Date(job.scheduled_for).getTime()}`
        )
      )

      const rowsToInsert: Array<{
        customer_service_id: number
        recurring_schedule_id: number
        scheduled_for: string
        status: string
      }> = []

      for (const schedule of schedulesToGenerate) {
        const customerService = customerServices.find(
          (service) => service.id === schedule.customer_service_id
        )
        if (!customerService) continue

        const service = services.find(
          (item) => item.id === customerService.service_id
        )
        if (!service) continue

        const startDate = startOfLocalDay(
          new Date(`${customerService.start_date}T12:00:00`)
        )
        const today = startOfLocalDay(new Date())
        let cursor = new Date(today)

        const frequency = service.frequency

        while (cursor <= horizon) {
          const matchesDay = cursor.getDay() === schedule.day_of_week
          const startsAfterService = cursor >= startDate

          let frequencyMatches = false

          if (frequency === "weekly" || frequency === "twice-weekly") {
            frequencyMatches = true
          } else if (frequency === "biweekly") {
            const diffDays = Math.floor(
              (startOfLocalDay(cursor).getTime() - startDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
            frequencyMatches = diffDays >= 0 && diffDays % 14 === 0
          }

          if (matchesDay && startsAfterService && frequencyMatches) {
            const scheduledDateTime = buildLocalDateTime(cursor, schedule.service_time)
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

          cursor.setDate(cursor.getDate() + 1)
        }
      }

      if (rowsToInsert.length === 0) {
        await loadDashboard()
        setJobsBusy(false)
        alert("Your upcoming jobs are already generated.")
        return
      }

      const { error: insertError } = await supabase
        .from("jobs")
        .insert(rowsToInsert)

      if (insertError) {
        console.error("Generate jobs error:", insertError)
        setErrorMessage("We couldn't generate the upcoming jobs. Please try again.")
        setJobsBusy(false)
        return
      }

      await loadDashboard()
      setJobsBusy(false)
      alert(`Generated ${rowsToInsert.length} upcoming job${rowsToInsert.length === 1 ? "" : "s"}.`)
    } catch (error) {
      console.error("Generate jobs unexpected error:", error)
      setErrorMessage("Something went wrong generating jobs. Please try again.")
      setJobsBusy(false)
    }
  }

  const getCustomerForJob = (job: Job) => {
    const customerService = customerServices.find(
      (service) => service.id === job.customer_service_id
    )

    return customers.find(
      (customer) => customer.id === customerService?.customer_id
    )
  }

  const getServiceForJob = (job: Job) => {
    const customerService = customerServices.find(
      (service) => service.id === job.customer_service_id
    )

    return services.find((service) => service.id === customerService?.service_id)
  }

  const getScheduleForJob = (job: Job) => {
    return recurringSchedules.find(
      (schedule) => schedule.id === job.recurring_schedule_id
    )
  }

  const selectedJob =
    selectedJobId === null
      ? null
      : jobs.find((job) => job.id === selectedJobId) || null

  const sendCustomerJobNotification = async (
    jobId: number,
    notificationType: "start_trip" | "arrived" | "completed"
  ) => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError || !sessionData.session?.access_token) {
        console.error("Customer notification session error:", sessionError)
        return false
      }

      const response = await fetch("/api/send-job-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          jobId,
          notificationType,
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        console.error("Customer notification error:", result)
        return false
      }

      const result = await response.json().catch(() => null)

      if (result?.skipped) {
        return true
      }

      return true
    } catch (error) {
      console.error("Customer notification unexpected error:", error)
      return false
    }
  }

  const chargeCompletedJob = async (jobId: number) => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError || !sessionData.session?.access_token) {
        console.error("Charge job session error:", sessionError)

        return {
          success: false,
          error: "Your admin session could not be verified.",
        }
      }

      const response = await fetch("/api/square-charge-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          jobId,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        console.error("Charge completed job error:", result)

        return {
          success: false,
          error:
            result?.error ||
            "The payment could not be processed.",
        }
      }

      return {
        success: true,
        alreadyPaid: Boolean(result?.alreadyPaid),
        freeCleanupApplied: Boolean(result?.freeCleanupApplied),
        payment: result?.payment || null,
      }
    } catch (error) {
      console.error("Charge completed job unexpected error:", error)

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong processing the payment.",
      }
    }
  }

  const updateJobStatus = async (
    job: Job,
    status: string,
    timestampField?: "departed_at" | "arrived_at"
  ) => {
    setJobActionBusy(true)
    setErrorMessage("")

    const payload: {
      status: string
      departed_at?: string
      arrived_at?: string
    } = {
      status,
    }

    if (timestampField) {
      payload[timestampField] = new Date().toISOString()
    }

    const { error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", job.id)

    if (error) {
      console.error("Update job status error:", error)
      setErrorMessage("We couldn't update this job. Please try again.")
      setJobActionBusy(false)
      return false
    }

    await loadDashboard()
    setJobActionBusy(false)

    return true
  }

  const handleStartTrip = async (job: Job) => {
    const updated = await updateJobStatus(
      job,
      "on_the_way",
      job.departed_at ? undefined : "departed_at"
    )

    if (!updated) return

    const notificationSent = await sendCustomerJobNotification(
      job.id,
      "start_trip"
    )

    if (!notificationSent) {
      alert(
        "Trip started, but we couldn't send the customer notification email."
      )
    }
  }

  const handleArrive = async (job: Job) => {
    const updated = await updateJobStatus(
      job,
      "arrived",
      job.arrived_at ? undefined : "arrived_at"
    )

    if (!updated) return

    const notificationSent = await sendCustomerJobNotification(
      job.id,
      "arrived"
    )

    if (!notificationSent) {
      alert(
        "Arrival was recorded, but we couldn't send the customer notification email."
      )
    }
  }

  const handleStartJob = async (job: Job) => {
    await updateJobStatus(job, "in_progress")
  }

  const handleCompleteJob = async (job: Job) => {
    if (!completionPhoto) {
      setErrorMessage(
        "Please add a completion photo before finishing the job."
      )
      return
    }

    if (!completionGateClosed) {
      setErrorMessage(
        "Please confirm the gate is closed before finishing the job."
      )
      return
    }

    setJobActionBusy(true)
    setErrorMessage("")

    const fileExtension = completionPhoto.name.includes(".")
      ? completionPhoto.name.split(".").pop()?.toLowerCase() || "jpg"
      : "jpg"

    const filePath = `${job.id}/${Date.now()}.${fileExtension}`

    // ------------------------------------------------------------
    // 1. Upload completion photo
    // ------------------------------------------------------------

    const { error: uploadError } = await supabase.storage
      .from("job-completion-photos")
      .upload(filePath, completionPhoto, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("Completion photo upload error:", uploadError)

      setErrorMessage(
        "We couldn't upload the completion photo. Please try again."
      )

      setJobActionBusy(false)
      return
    }

    // ------------------------------------------------------------
    // 2. Mark job completed
    // ------------------------------------------------------------

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_photo_url: filePath,
        gate_closed: true,
      })
      .eq("id", job.id)

    if (updateError) {
      console.error("Complete job update error:", updateError)

      setErrorMessage(
        "The photo uploaded, but we couldn't mark the job completed."
      )

      setJobActionBusy(false)
      return
    }

    // ------------------------------------------------------------
    // 3. Process payment
    //
    // The payment route automatically determines whether:
    // - this is the customer's free first cleanup
    // - the customer should be charged
    // - the job was already paid
    //
    // A payment failure does NOT undo the completed job.
    // ------------------------------------------------------------

    const paymentResult = await chargeCompletedJob(job.id)

    // ------------------------------------------------------------
    // 4. Send completed-service customer email
    // ------------------------------------------------------------

    const notificationSent = await sendCustomerJobNotification(
      job.id,
      "completed"
    )

    // ------------------------------------------------------------
    // 5. Clean up UI state
    // ------------------------------------------------------------

    setCompletionPhoto(null)
    setCompletionGateClosed(false)
    setSelectedJobId(null)

    await loadDashboard()

    setJobActionBusy(false)

    // ------------------------------------------------------------
    // 6. Tell Brandon exactly what happened
    // ------------------------------------------------------------

    if (!paymentResult.success) {
      if (notificationSent) {
        alert(
          "Job completed and customer notification sent, but the payment could not be processed.\n\n" +
            paymentResult.error
        )
      } else {
        alert(
          "Job completed, but the payment and customer notification could not be processed.\n\n" +
            `Payment: ${paymentResult.error}`
        )
      }

      return
    }

    if (paymentResult.freeCleanupApplied) {
      if (notificationSent) {
        alert(
          "Job completed!\n\n" +
            "This customer's first cleanup was applied as FREE.\n\n" +
            "Completion photo saved and customer notification sent."
        )
      } else {
        alert(
          "Job completed!\n\n" +
            "This customer's first cleanup was applied as FREE.\n\n" +
            "Completion photo saved, but the customer notification email could not be sent."
        )
      }

      return
    }

    if (paymentResult.alreadyPaid) {
      if (notificationSent) {
        alert(
          "Job completed!\n\n" +
            "This job was already recorded as paid.\n\n" +
            "Completion photo saved and customer notification sent."
        )
      } else {
        alert(
          "Job completed!\n\n" +
            "This job was already recorded as paid.\n\n" +
            "Completion photo saved, but the customer notification email could not be sent."
        )
      }

      return
    }

    const paidAmount =
      paymentResult.payment?.amount !== undefined &&
      paymentResult.payment?.amount !== null
        ? Number(paymentResult.payment.amount)
        : null

    const paidAmountText =
      paidAmount !== null && Number.isFinite(paidAmount)
        ? `$${paidAmount.toFixed(2)}`
        : "the agreed amount"

    if (notificationSent) {
      alert(
        `Job completed!\n\n` +
          `Square charged ${paidAmountText} successfully.\n\n` +
          "Payment recorded, completion photo saved, and customer notification sent."
      )
    } else {
      alert(
        `Job completed!\n\n` +
          `Square charged ${paidAmountText} successfully.\n\n` +
          "Payment recorded and completion photo saved, but the customer notification email could not be sent."
      )
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJobId(job.id)
    setCompletionPhoto(null)
    setCompletionGateClosed(job.gate_closed)
    setErrorMessage("")
  }

  const closeJobDetails = () => {
    if (jobActionBusy) return

    setSelectedJobId(null)
    setCompletionPhoto(null)
    setCompletionGateClosed(false)
  }

  const upcomingJobs = jobs.filter(
    (job) => new Date(job.scheduled_for).getTime() >= Date.now()
  )

  const todaysJobs = upcomingJobs.filter((job) => {
    const jobDate = new Date(job.scheduled_for)
    const today = new Date()

    return (
      jobDate.getFullYear() === today.getFullYear() &&
      jobDate.getMonth() === today.getMonth() &&
      jobDate.getDate() === today.getDate()
    )
  })

  const startOfWeek = (date: Date) => {
    const result = new Date(date)
    result.setHours(0, 0, 0, 0)
    result.setDate(result.getDate() - result.getDay())
    return result
  }

  const addDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  const isSameCalendarDay = (a: Date, b: Date) => {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  const weekStart = startOfWeek(calendarDate)
  const calendarDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  )

  const monthStart = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    1
  )
  const monthEnd = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    0
  )
  const monthStartCalendar = startOfWeek(monthStart)
  const monthEndCalendar = addDays(startOfWeek(monthEnd), 6)
  const monthDayCount =
    Math.round(
      (monthEndCalendar.getTime() - monthStartCalendar.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  const monthCalendarDays = Array.from({ length: monthDayCount }, (_, index) =>
    addDays(monthStartCalendar, index)
  )

  const calendarJobsForDay = (day: Date) =>
    jobs
      .filter((job) => isSameCalendarDay(new Date(job.scheduled_for), day))
      .sort(
        (a, b) =>
          new Date(a.scheduled_for).getTime() -
          new Date(b.scheduled_for).getTime()
      )

  const calendarAppointmentsForDay = (day: Date) =>
    upcomingAppointments
      .filter((appointment) =>
        isSameCalendarDay(new Date(appointment.scheduled_at), day)
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime()
      )

  const calendarTitle =
    calendarView === "week"
      ? `${weekStart.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} – ${calendarDays[6].toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : calendarDate.toLocaleDateString([], {
          month: "long",
          year: "numeric",
        })

  const goToPreviousCalendarPeriod = () => {
    const next = new Date(calendarDate)

    if (calendarView === "week") {
      next.setDate(next.getDate() - 7)
    } else {
      next.setMonth(next.getMonth() - 1)
    }

    setCalendarDate(next)
  }

  const goToNextCalendarPeriod = () => {
    const next = new Date(calendarDate)

    if (calendarView === "week") {
      next.setDate(next.getDate() + 7)
    } else {
      next.setMonth(next.getMonth() + 1)
    }

    setCalendarDate(next)
  }

  const goToToday = () => {
    setCalendarDate(new Date())
  }


  return (
    <main className="min-h-screen bg-[#FEFBF7] text-[#0A1821]">
      <header className="border-b border-[#0A1821]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <img
              src="/dooty-done-logo.png"
              alt="Dooty Done"
              className="h-14 w-auto object-contain"
            />

            <div className="hidden border-l border-[#0A1821]/10 pl-4 sm:block">
              <p className="text-sm font-black">Business Dashboard</p>
              <p className="text-xs text-[#0A1821]/50">
                Dooty Done LLC
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-full border border-[#0A1821]/15 px-5 py-2.5 text-sm font-extrabold transition hover:border-[#678739] hover:text-[#678739]"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
              Admin
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Good to see you.
            </h1>

            <p className="mt-2 text-[#0A1821]/60">
              Signed in as {userEmail}
            </p>
          </div>

          <button
            onClick={loadDashboard}
            className="w-fit rounded-full bg-[#678739] px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e]"
          >
            Refresh Dashboard
          </button>
        </div>

        {errorMessage && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-10 text-center shadow-sm">
            <p className="font-bold text-[#0A1821]/60">
              Loading your dashboard...
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-extrabold uppercase tracking-wide text-[#0A1821]/45">
                  Recent Customers
                </p>

                <p className="mt-3 text-4xl font-black text-[#678739]">
                  {customers.length}
                </p>
              </div>

              <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-extrabold uppercase tracking-wide text-[#0A1821]/45">
                  Upcoming Appointments
                </p>

                <p className="mt-3 text-4xl font-black text-[#678739]">
                  {upcomingAppointments.length}
                </p>
              </div>

              <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-extrabold uppercase tracking-wide text-[#0A1821]/45">
                  Open Consultation Slots
                </p>

                <p className="mt-3 text-4xl font-black text-[#678739]">
                  {availability.length}
                </p>
              </div>

              <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm">
                <p className="text-sm font-extrabold uppercase tracking-wide text-[#0A1821]/45">
                  Business Phone
                </p>

                <p className="mt-3 text-lg font-black">
                  (719) 425-8838
                </p>
              </div>
            </div>

            <section className="mt-10 rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                    Calendar
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Your Schedule
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#0A1821]/60">
                    See consultations and service visits in one place so you can
                    quickly see who you are seeing and when.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousCalendarPeriod}
                    className="rounded-full border border-[#0A1821]/15 bg-white px-4 py-2.5 text-sm font-black transition hover:border-[#678739] hover:text-[#678739]"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={goToToday}
                    className="rounded-full border border-[#0A1821]/15 bg-white px-4 py-2.5 text-sm font-black transition hover:border-[#678739] hover:text-[#678739]"
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={goToNextCalendarPeriod}
                    className="rounded-full border border-[#0A1821]/15 bg-white px-4 py-2.5 text-sm font-black transition hover:border-[#678739] hover:text-[#678739]"
                  >
                    →
                  </button>

                                    <button
                    type="button"
                    onClick={handleGenerateUpcomingJobs}
                    disabled={
                      jobsBusy ||
                      recurringSchedules.filter((schedule) => schedule.active).length === 0
                    }
                    className="rounded-full bg-[#678739] px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {jobsBusy ? "Generating..." : "Generate Next 6 Weeks"}
                  </button>

<div className="ml-0 flex rounded-full bg-[#F1F5EA] p-1">
                    <button
                      type="button"
                      onClick={() => setCalendarView("week")}
                      className={`rounded-full px-4 py-2 text-xs font-black transition ${
                        calendarView === "week"
                          ? "bg-white text-[#536f2e] shadow-sm"
                          : "text-[#0A1821]/55"
                      }`}
                    >
                      Week
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalendarView("month")}
                      className={`rounded-full px-4 py-2 text-xs font-black transition ${
                        calendarView === "month"
                          ? "bg-white text-[#536f2e] shadow-sm"
                          : "text-[#0A1821]/55"
                      }`}
                    >
                      Month
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-lg font-black">{calendarTitle}</h3>

                <div className="flex items-center gap-3 text-xs font-bold text-[#0A1821]/50">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#678739]" />
                    Service
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0A1821]" />
                    Consultation
                  </span>
                </div>
              </div>

              {calendarView === "week" ? (
                <div className="mt-5 overflow-x-auto">
                  <div className="grid min-w-[980px] grid-cols-7 overflow-hidden rounded-2xl border border-[#0A1821]/10">
                    {calendarDays.map((day) => {
                      const dayJobs = calendarJobsForDay(day)
                      const dayAppointments = calendarAppointmentsForDay(day)
                      const isToday = isSameCalendarDay(day, new Date())

                      return (
                        <div
                          key={day.toISOString()}
                          className="min-h-[360px] border-r border-[#0A1821]/10 last:border-r-0"
                        >
                          <div
                            className={`border-b border-[#0A1821]/10 px-3 py-3 ${
                              isToday ? "bg-[#F1F5EA]" : "bg-white"
                            }`}
                          >
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#0A1821]/45">
                              {day.toLocaleDateString([], { weekday: "short" })}
                            </p>
                            <p
                              className={`mt-1 text-xl font-black ${
                                isToday ? "text-[#678739]" : "text-[#0A1821]"
                              }`}
                            >
                              {day.getDate()}
                            </p>
                          </div>

                          <div className="space-y-2 p-2">
                            {dayAppointments.map((appointment) => {
                              const customer = appointment.customer?.[0]

                              return (
                                <div
                                  key={`appointment-${appointment.id}`}
                                  className="rounded-xl border border-[#0A1821]/10 bg-[#F7F7F7] p-3"
                                >
                                  <p className="text-[11px] font-black uppercase tracking-wide text-[#0A1821]/45">
                                    Consultation
                                  </p>
                                  <p className="mt-1 text-sm font-black">
                                    {customer
                                      ? `${customer.first_name} ${customer.last_name}`
                                      : "Customer"}
                                  </p>
                                  <p className="mt-1 text-xs font-bold text-[#0A1821]/60">
                                    {new Date(
                                      appointment.scheduled_at
                                    ).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              )
                            })}

                            {dayJobs.map((job) => {
                              const customer = getCustomerForJob(job)
                              const service = getServiceForJob(job)

                              return (
                                <button
                                  type="button"
                                  key={`job-${job.id}`}
                                  onClick={() => handleJobClick(job)}
                                  className="w-full rounded-xl border border-[#678739]/20 bg-[#F1F5EA] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#678739]/45 hover:shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[11px] font-black uppercase tracking-wide text-[#536f2e]">
                                      Service
                                    </p>

                                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-[#536f2e]">
                                      {job.status.replace("_", " ")}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-sm font-black">
                                    {customer
                                      ? `${customer.first_name} ${customer.last_name}`
                                      : "Customer"}
                                  </p>

                                  <p className="mt-1 text-xs font-bold text-[#0A1821]/60">
                                    {new Date(
                                      job.scheduled_for
                                    ).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </p>

                                  <p className="mt-1 text-[11px] font-semibold text-[#0A1821]/50">
                                    {service?.name || "Recurring Service"}
                                  </p>
                                </button>
                              )
                            })}

                            {dayAppointments.length === 0 &&
                              dayJobs.length === 0 && (
                                <div className="flex min-h-[250px] items-center justify-center rounded-xl border border-dashed border-[#0A1821]/10 p-4 text-center text-xs font-semibold text-[#0A1821]/35">
                                  No appointments
                                </div>
                              )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-[#0A1821]/10">
                  <div className="grid grid-cols-7 border-b border-[#0A1821]/10">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="border-r border-[#0A1821]/10 bg-[#F8FAF5] px-2 py-3 text-center text-[11px] font-black uppercase tracking-wide text-[#0A1821]/45 last:border-r-0"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-7">
                    {monthCalendarDays.map((day) => {
                      const dayJobs = calendarJobsForDay(day)
                      const dayAppointments = calendarAppointmentsForDay(day)
                      const isCurrentMonth =
                        day.getMonth() === calendarDate.getMonth()
                      const isToday = isSameCalendarDay(day, new Date())

                      return (
                        <div
                          key={day.toISOString()}
                          className={`min-h-[120px] border-b border-r border-[#0A1821]/10 p-2 last:border-r-0 ${
                            isCurrentMonth ? "bg-white" : "bg-[#FBFCF9]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm font-black ${
                                isToday
                                  ? "text-[#678739]"
                                  : isCurrentMonth
                                  ? "text-[#0A1821]"
                                  : "text-[#0A1821]/30"
                              }`}
                            >
                              {day.getDate()}
                            </span>

                            {(dayJobs.length > 0 ||
                              dayAppointments.length > 0) && (
                              <span className="rounded-full bg-[#F1F5EA] px-2 py-0.5 text-[9px] font-black text-[#536f2e]">
                                {dayJobs.length + dayAppointments.length}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {dayAppointments.slice(0, 3).map((appointment) => {
                              const customer = appointment.customer?.[0]

                              return (
                                <div
                                  key={`month-appointment-${appointment.id}`}
                                  className="rounded-lg bg-[#F4F4F4] px-2 py-1.5"
                                >
                                  <p className="truncate text-[10px] font-black">
                                    {new Date(
                                      appointment.scheduled_at
                                    ).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}{" "}
                                    ·{" "}
                                    {customer?.first_name || "Consultation"}
                                  </p>
                                </div>
                              )
                            })}

                            {dayJobs.slice(0, 3).map((job) => {
                              const customer = getCustomerForJob(job)

                              return (
                                <button
                                  type="button"
                                  key={`month-job-${job.id}`}
                                  onClick={() => handleJobClick(job)}
                                  className="w-full rounded-lg bg-[#F1F5EA] px-2 py-1.5 text-left transition hover:bg-[#E7EFDA]"
                                >
                                  <p className="truncate text-[10px] font-black text-[#536f2e]">
                                    {new Date(
                                      job.scheduled_for
                                    ).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}{" "}
                                    ·{" "}
                                    {customer?.first_name || "Service"}
                                  </p>
                                </button>
                              )
                            })}

                            {dayJobs.length + dayAppointments.length > 6 && (
                              <p className="px-1 text-[10px] font-bold text-[#0A1821]/40">
                                + more
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                      Schedule
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      Upcoming Consultations
                    </h2>
                  </div>

                  <span className="rounded-full bg-[#F1F5EA] px-3 py-1.5 text-xs font-black text-[#536f2e]">
                    {upcomingAppointments.length}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {upcomingAppointments.length === 0 ? (
                    <div className="rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold text-[#0A1821]/60">
                      No upcoming consultations.
                    </div>
                  ) : (
                    upcomingAppointments.map((appointment) => {
                      const customer = appointment.customer?.[0] || null

                      return (
                        <div
                          key={appointment.id}
                          className="rounded-2xl border border-[#0A1821]/10 bg-[#FEFBF7] p-5"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-lg font-black">
                                {customer
                                  ? `${customer.first_name} ${customer.last_name}`
                                  : "Customer"}
                              </p>

                              <p className="mt-1 font-bold text-[#678739]">
                                {formatDateTime(appointment.scheduled_at)}
                              </p>

                              {customer && (
                                <>
                                  <p className="mt-2 text-sm text-[#0A1821]/65">
                                    {customer.phone}
                                  </p>

                                  <p className="text-sm text-[#0A1821]/65">
                                    {customer.address}
                                  </p>
                                </>
                              )}
                            </div>

                            <span className="w-fit rounded-full bg-[#678739]/10 px-3 py-1.5 text-xs font-black uppercase text-[#536f2e]">
                              {appointment.status}
                            </span>
                          </div>

                          {appointment.notes && (
                            <p className="mt-4 border-t border-[#0A1821]/10 pt-4 text-sm leading-6 text-[#0A1821]/60">
                              {appointment.notes}
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
                <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                  Availability
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Manage Quote Slots
                </h2>

                <form
                  onSubmit={handleAddAvailability}
                  className="mt-6 space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="new-availability-date"
                        className="mb-2 block text-sm font-extrabold"
                      >
                        Date
                      </label>

                      <input
                        id="new-availability-date"
                        type="date"
                        value={newDate}
                        onChange={(event) => setNewDate(event.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        required
                        className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-availability-time"
                        className="mb-2 block text-sm font-extrabold"
                      >
                        Time
                      </label>

                      <input
                        id="new-availability-time"
                        type="time"
                        value={newTime}
                        onChange={(event) => setNewTime(event.target.value)}
                        required
                        className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={availabilityBusy}
                    className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {availabilityBusy ? "Saving..." : "Add Consultation Slot"}
                  </button>
                </form>

                <div className="mt-8 border-t border-[#0A1821]/10 pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-black">
                      Open Quote Slots
                    </h3>

                    <span className="rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black text-[#536f2e]">
                      {availability.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {availability.length === 0 ? (
                      <div className="rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold text-[#0A1821]/60">
                        No open consultation slots.
                      </div>
                    ) : (
                      availability.slice(0, 10).map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-[#F1F5EA] p-4"
                        >
                          <div>
                            <p className="font-black">
                              {formatAvailabilityDate(slot.available_date)}
                            </p>

                            <p className="text-sm font-semibold text-[#0A1821]/60">
                              {formatAvailabilityTime(slot.available_time)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAvailability(slot.id)
                            }
                            disabled={availabilityBusy}
                            className="rounded-full border border-[#0A1821]/15 bg-white px-3.5 py-2 text-xs font-black text-[#0A1821] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>

            <section className="mt-8 rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                    Quotes
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Quote Management
                  </h2>
                </div>

                <span className="w-fit rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black uppercase text-[#536f2e]">
                  {quotes.length} saved
                </span>
              </div>

              <form
                onSubmit={handleSaveQuote}
                className="mt-6 space-y-5"
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label
                      htmlFor="quote-customer"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Customer
                    </label>

                    <select
                      id="quote-customer"
                      value={quoteCustomerId}
                      onChange={(event) =>
                        handleCustomerSelection(event.target.value)
                      }
                      required
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                    >
                      <option value="" disabled>
                        Select a customer
                      </option>

                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.first_name} {customer.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="quote-appointment"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Consultation
                    </label>

                    <select
                      id="quote-appointment"
                      value={quoteAppointmentId}
                      onChange={(event) =>
                        handleAppointmentSelection(event.target.value)
                      }
                      required
                      disabled={!quoteCustomerId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:cursor-not-allowed disabled:bg-[#F5F5F5]"
                    >
                      <option value="" disabled>
                        {quoteCustomerId
                          ? "Select consultation"
                          : "Choose customer first"}
                      </option>

                      {appointments
                        .filter(
                          (appointment) =>
                            appointment.customer_id ===
                            Number(quoteCustomerId)
                        )
                        .map((appointment) => (
                          <option
                            key={appointment.id}
                            value={appointment.id}
                          >
                            {formatDateTime(appointment.scheduled_at)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="quote-price"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Quoted Price
                    </label>

                    <input
                      id="quote-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={quotePrice}
                      onChange={(event) =>
                        setQuotePrice(event.target.value)
                      }
                      placeholder="35.00"
                      required
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="quote-frequency"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Service Frequency
                    </label>

                    <select
                      id="quote-frequency"
                      value={quoteFrequency}
                      onChange={(event) =>
                        setQuoteFrequency(event.target.value)
                      }
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                    >
                      <option value="">Select frequency</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">
                        Every Other Week
                      </option>
                      <option value="twice-weekly">
                        Twice Weekly
                      </option>
                      <option value="one-time">
                        One-Time Cleanup
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="quote-status"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Status
                    </label>

                    <select
                      id="quote-status"
                      value={quoteStatus}
                      onChange={(event) =>
                        setQuoteStatus(event.target.value)
                      }
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                    >
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="quote-notes"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Quote Notes
                  </label>

                  <textarea
                    id="quote-notes"
                    value={quoteNotes}
                    onChange={(event) =>
                      setQuoteNotes(event.target.value)
                    }
                    rows={4}
                    placeholder="Yard condition, pricing details, special instructions, etc."
                    className="w-full resize-none rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={quoteBusy}
                  className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {quoteBusy ? "Saving Quote..." : "Save Quote"}
                </button>
              </form>

              <div className="mt-8 border-t border-[#0A1821]/10 pt-6">
                <h3 className="text-lg font-black">Recent Quotes</h3>

                <div className="mt-4 space-y-3">
                  {quotes.slice(0, 10).map((quote) => {
                    const customer = customers.find(
                      (item) => item.id === quote.customer_id
                    )

                    return (
                      <div
                        key={quote.id}
                        className="flex flex-col gap-3 rounded-2xl bg-[#F1F5EA] p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-black">
                            {customer
                              ? `${customer.first_name} ${customer.last_name}`
                              : "Customer"}
                          </p>

                          <p className="text-sm text-[#0A1821]/60">
                            {quote.quoted_price !== null
                              ? `$${Number(
                                  quote.quoted_price
                                ).toFixed(2)}`
                              : "No price"}{" "}
                            {quote.service_frequency
                              ? `• ${formatFrequency(
                                  quote.service_frequency
                                )}`
                              : ""}
                          </p>
                        </div>

                        <select
                          value={quote.status}
                          onChange={(event) =>
                            handleQuoteStatusChange(
                              quote,
                              event.target.value
                            )
                          }
                          disabled={quoteBusy}
                          className="rounded-full border border-[#0A1821]/15 bg-white px-3 py-2 text-xs font-black uppercase text-[#536f2e] outline-none transition focus:border-[#678739] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                        </select>
                      </div>
                    )
                  })}

                  {quotes.length === 0 && (
                    <div className="rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold text-[#0A1821]/60">
                      No quotes have been saved yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                    Recurring Services
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Recurring Service Setup
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#0A1821]/60">
                    Set up the customer's ongoing service after they accept
                    their quote.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black uppercase text-[#536f2e]">
                  {customerServices.filter(
                    (service) => service.status === "active"
                  ).length}{" "}
                  active
                </span>
              </div>

              <form
                onSubmit={handleSaveRecurringService}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="recurring-customer"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Customer
                  </label>

                  <select
                    id="recurring-customer"
                    value={recurringCustomerId}
                    onChange={(event) =>
                      handleRecurringCustomerSelection(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  >
                    <option value="" disabled>
                      {acceptedRecurringCustomers.length > 0
                        ? "Select customer with accepted recurring quote"
                        : "No accepted recurring quotes yet"}
                    </option>

                    {acceptedRecurringCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name}
                      </option>
                    ))}
                  </select>

                  {acceptedRecurringCustomers.length === 0 && (
                    <p className="mt-2 text-xs font-semibold text-[#0A1821]/50">
                      A recurring customer will appear here after their
                      quote is marked accepted above.
                    </p>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="recurring-service"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Recurring Service
                    </label>

                    <select
                      id="recurring-service"
                      value={recurringServiceId}
                      onChange={(event) =>
                        handleRecurringServiceSelection(
                          event.target.value
                        )
                      }
                      required
                      disabled={!recurringCustomerId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:cursor-not-allowed disabled:bg-[#F5F5F5]"
                    >
                      <option value="" disabled>
                        {recurringCustomerId
                          ? "Select service"
                          : "Choose customer first"}
                      </option>

                      {recurringServicesOnly.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="recurring-price"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Agreed Price Per Visit
                    </label>

                    <input
                      id="recurring-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={recurringPrice}
                      onChange={(event) =>
                        setRecurringPrice(event.target.value)
                      }
                      placeholder="18.00"
                      required
                      disabled={!recurringCustomerId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:bg-[#F5F5F5]"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="recurring-start-date"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Service Start Date
                    </label>

                    <input
                      id="recurring-start-date"
                      type="date"
                      value={recurringStartDate}
                      onChange={(event) =>
                        setRecurringStartDate(event.target.value)
                      }
                      required
                      disabled={!recurringCustomerId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:bg-[#F5F5F5]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="recurring-status"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Status
                    </label>

                    <select
                      id="recurring-status"
                      value={recurringStatus}
                      onChange={(event) =>
                        setRecurringStatus(event.target.value)
                      }
                      disabled={!recurringCustomerId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:bg-[#F5F5F5]"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="recurring-notes"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Service Notes
                  </label>

                  <textarea
                    id="recurring-notes"
                    value={recurringNotes}
                    onChange={(event) =>
                      setRecurringNotes(event.target.value)
                    }
                    rows={4}
                    placeholder="Gate code, yard instructions, preferred day, special notes, etc."
                    disabled={!recurringCustomerId}
                    className="w-full resize-none rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:bg-[#F5F5F5]"
                  />
                </div>

                <div className="rounded-2xl bg-[#F1F5EA] p-4 text-sm leading-6 text-[#0A1821]/65">
                  <span className="font-black text-[#536f2e]">
                    First Cleanup:
                  </span>{" "}
                  The free initial cleanup is tracked separately and is not
                  automatically marked as used here.
                </div>

                <button
                  type="submit"
                  disabled={
                    recurringBusy ||
                    acceptedRecurringCustomers.length === 0
                  }
                  className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recurringBusy
                    ? "Saving Recurring Service..."
                    : "Save Recurring Service"}
                </button>
              </form>

              <div className="mt-8 border-t border-[#0A1821]/10 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-black">
                    Current Recurring Services
                  </h3>

                  <span className="rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black text-[#536f2e]">
                    {customerServices.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {customerServices.slice(0, 10).map((customerService) => {
                    const customer = customers.find(
                      (item) =>
                        item.id === customerService.customer_id
                    )

                    const service = services.find(
                      (item) =>
                        item.id === customerService.service_id
                    )

                    return (
                      <div
                        key={customerService.id}
                        className="rounded-2xl bg-[#F1F5EA] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-black">
                              {customer
                                ? `${customer.first_name} ${customer.last_name}`
                                : "Customer"}
                            </p>

                            <p className="mt-1 text-sm text-[#0A1821]/60">
                              {service?.name || "Recurring Service"}{" "}
                              •{" "}
                              {customerService.agreed_price !== null
                                ? `$${Number(
                                    customerService.agreed_price
                                  ).toFixed(2)} / visit`
                                : "No price"}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-[#0A1821]/50">
                              Starts{" "}
                              {new Date(
                                `${customerService.start_date}T12:00:00`
                              ).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-[#536f2e]">
                              {customerService.status}
                            </span>

                            {customerService.status === "active" && (
                              <button
                                type="button"
                                onClick={() => handleStopService(customerService)}
                                disabled={recurringBusy}
                                className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Stop Service
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {customerServices.length === 0 && (
                    <div className="rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold text-[#0A1821]/60">
                      No recurring services have been set up yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                    Scheduling
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Recurring Scheduling
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#0A1821]/60">
                    Assign the regular day and time for an active recurring customer. Weekly and every-other-week services use one schedule; twice-weekly services can use two.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black uppercase text-[#536f2e]">
                  {recurringSchedules.filter((schedule) => schedule.active).length} schedules
                </span>
              </div>

              <form
                onSubmit={handleSaveRecurringSchedule}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="schedule-customer-service"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Customer
                  </label>

                  <select
                    id="schedule-customer-service"
                    value={scheduleCustomerServiceId}
                    onChange={(event) =>
                      handleScheduleCustomerSelection(event.target.value)
                    }
                    required
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  >
                    <option value="" disabled>
                      {activeRecurringCustomerServices.length > 0
                        ? "Select active recurring customer"
                        : "No active recurring customers yet"}
                    </option>

                    {activeRecurringCustomerServices.map((customerService) => {
                      const customer = customers.find(
                        (item) => item.id === customerService.customer_id
                      )
                      const service = services.find(
                        (item) => item.id === customerService.service_id
                      )

                      return (
                        <option key={customerService.id} value={customerService.id}>
                          {customer
                            ? `${customer.first_name} ${customer.last_name}`
                            : "Customer"} - {service?.name || "Recurring Service"}
                        </option>
                      )
                    })}
                  </select>

                  {activeRecurringCustomerServices.length === 0 && (
                    <p className="mt-2 text-xs font-semibold text-[#0A1821]/50">
                      Set a customer's recurring service to Active first.
                    </p>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="schedule-day"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Service Day
                    </label>

                    <select
                      id="schedule-day"
                      value={scheduleDay}
                      onChange={(event) => setScheduleDay(event.target.value)}
                      required
                      disabled={!scheduleCustomerServiceId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:cursor-not-allowed disabled:bg-[#F5F5F5]"
                    >
                      <option value="" disabled>
                        Select day
                      </option>
                      {dayNames.map((day, index) => (
                        <option key={day} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="schedule-time"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Service Time
                    </label>

                    <input
                      id="schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(event) => setScheduleTime(event.target.value)}
                      required
                      disabled={!scheduleCustomerServiceId}
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:cursor-not-allowed disabled:bg-[#F5F5F5]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="schedule-notes"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Schedule Notes
                  </label>

                  <textarea
                    id="schedule-notes"
                    value={scheduleNotes}
                    onChange={(event) => setScheduleNotes(event.target.value)}
                    rows={3}
                    placeholder="Preferred access time, gate instructions, timing notes, etc."
                    disabled={!scheduleCustomerServiceId}
                    className="w-full resize-none rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:bg-[#F5F5F5]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    scheduleBusy || activeRecurringCustomerServices.length === 0
                  }
                  className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {scheduleBusy
                    ? "Saving Schedule..."
                    : "Save Recurring Schedule"}
                </button>
              </form>

              <div className="mt-8 border-t border-[#0A1821]/10 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-black">Current Schedules</h3>

                  <span className="rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black text-[#536f2e]">
                    {recurringSchedules.filter((schedule) => schedule.active).length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {recurringSchedules.filter((schedule) => schedule.active).length === 0 ? (
                    <div className="rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold text-[#0A1821]/60">
                      No recurring schedules have been set up yet.
                    </div>
                  ) : (
                    recurringSchedules
                      .filter((schedule) => schedule.active)
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className="rounded-2xl bg-[#F1F5EA] p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-black">
                                {getCustomerNameForService(
                                  schedule.customer_service_id
                                )}
                              </p>

                              <p className="mt-1 text-sm font-semibold text-[#678739]">
                                {formatScheduleDay(schedule.day_of_week)} at {formatServiceTime(schedule.service_time)}
                              </p>

                              <p className="mt-1 text-xs font-semibold text-[#0A1821]/50">
                                {getServiceNameForCustomerService(
                                  schedule.customer_service_id
                                )}
                              </p>

                              {schedule.notes && (
                                <p className="mt-2 text-xs leading-5 text-[#0A1821]/55">
                                  {schedule.notes}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveRecurringSchedule(schedule.id)
                              }
                              disabled={scheduleBusy}
                              className="w-fit rounded-full border border-[#0A1821]/15 bg-white px-3.5 py-2 text-xs font-black text-[#0A1821] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
              <div>
                <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                  Customers
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Recent Customers
                </h2>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-[#0A1821]/10 text-xs uppercase tracking-wide text-[#0A1821]/45">
                      <th className="pb-3 pr-4">Customer</th>
                      <th className="pb-3 pr-4">Phone</th>
                      <th className="pb-3 pr-4">Dogs</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Address</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-[#0A1821]/5 last:border-0"
                      >
                        <td className="py-4 pr-4 font-black">
                          {customer.first_name} {customer.last_name}
                        </td>

                        <td className="py-4 pr-4 text-sm">
                          {customer.phone}
                        </td>

                        <td className="py-4 pr-4 text-sm">
                          {customer.number_of_dogs ?? "—"}
                        </td>

                        <td className="py-4 pr-4">
                          <span className="rounded-full bg-[#F1F5EA] px-3 py-1 text-xs font-black uppercase text-[#536f2e]">
                            {customer.status}
                          </span>
                        </td>

                        <td className="py-4 text-sm text-[#0A1821]/60">
                          {customer.address}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {customers.length === 0 && (
                  <div className="py-8 text-center text-sm font-semibold text-[#0A1821]/50">
                    No customers found.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1821]/45 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                  Job Details
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {getCustomerForJob(selectedJob)
                    ? `${getCustomerForJob(selectedJob)?.first_name} ${getCustomerForJob(selectedJob)?.last_name}`
                    : "Customer"}
                </h2>
                <p className="mt-1 text-sm font-bold text-[#0A1821]/60">
                  {formatJobDateTime(selectedJob.scheduled_for)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeJobDetails}
                disabled={jobActionBusy}
                className="rounded-full border border-[#0A1821]/10 px-3 py-1.5 text-lg font-black text-[#0A1821]/60 hover:text-[#0A1821] disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-[#F1F5EA] p-4">
              <p className="text-sm font-black">
                {getServiceForJob(selectedJob)?.name || "Recurring Service"}
              </p>
              <p className="mt-1 text-sm text-[#0A1821]/60">
                {getCustomerForJob(selectedJob)?.address || "Address unavailable"}
              </p>
              <p className="mt-2 text-xs font-black uppercase text-[#536f2e]">
                Status: {selectedJob.status.replace("_", " ")}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {selectedJob.status === "scheduled" && (
                <button
                  type="button"
                  onClick={() => handleStartTrip(selectedJob)}
                  disabled={jobActionBusy}
                  className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {jobActionBusy ? "Updating..." : "🚗 Start Trip"}
                </button>
              )}

              {selectedJob.status === "on_the_way" && (
                <button
                  type="button"
                  onClick={() => handleArrive(selectedJob)}
                  disabled={jobActionBusy}
                  className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {jobActionBusy ? "Updating..." : "🏠 Mark Arrived"}
                </button>
              )}

              {selectedJob.status === "arrived" && (
                <button
                  type="button"
                  onClick={() => handleStartJob(selectedJob)}
                  disabled={jobActionBusy}
                  className="w-full rounded-full bg-[#678739] px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {jobActionBusy ? "Updating..." : "🧹 Start Job"}
                </button>
              )}

              {(selectedJob.status === "in_progress" || selectedJob.status === "arrived") && (
                <div className="rounded-2xl border border-[#0A1821]/10 bg-white p-4">
                  <p className="text-sm font-black">Completion Photo</p>
                  <p className="mt-1 text-xs leading-5 text-[#0A1821]/55">
                    Take a photo after the yard is cleaned, ideally showing the yard and gate closed. On a phone this can open the camera.
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) =>
                      setCompletionPhoto(event.target.files?.[0] || null)
                    }
                    disabled={jobActionBusy}
                    className="mt-3 block w-full text-sm"
                  />

                  <label className="mt-4 flex items-center gap-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={completionGateClosed}
                      onChange={(event) =>
                        setCompletionGateClosed(event.target.checked)
                      }
                      disabled={jobActionBusy}
                      className="h-4 w-4 accent-[#678739]"
                    />
                    Gate is closed and secured
                  </label>

                  <button
                    type="button"
                    onClick={() => handleCompleteJob(selectedJob)}
                    disabled={jobActionBusy}
                    className="mt-4 w-full rounded-full bg-[#0A1821] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#162a35] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {jobActionBusy ? "Completing..." : "✅ Complete Job"}
                  </button>
                </div>
              )}

              {selectedJob.status === "completed" && (
                <div className="rounded-2xl bg-[#F1F5EA] p-4 text-sm font-semibold text-[#0A1821]/65">
                  ✅ This job is completed. Gate confirmation: {selectedJob.gate_closed ? "Confirmed closed" : "Not confirmed"}.
                  {selectedJob.completion_photo_url && (
                    <p className="mt-2 text-xs text-[#0A1821]/50">
                      Completion photo is saved securely.
                    </p>
                  )}
                </div>
              )}

              {selectedJob.status === "cancelled" && (
                <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  This job was cancelled.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}