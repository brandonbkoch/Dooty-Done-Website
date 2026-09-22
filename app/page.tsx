"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
const services = [
  {
    title: "Weekly",
    price: "$18",
    description:
      "Our most popular option for keeping your yard consistently clean.",
    included: "1 dog included",
    additional: "+ $5 per additional dog",
    popular: true,
  },
  {
    title: "Every Other Week",
    price: "$23",
    description:
      "A great option for yards that don't need weekly attention.",
    included: "1 dog included",
    additional: "+ $5 per additional dog",
    popular: false,
  },
  {
    title: "Twice Weekly",
    price: "$32",
    description:
      "Extra-frequent service for busy households and multiple dogs.",
    included: "1 dog included",
    additional: "+ $5 per additional dog",
    popular: false,
  },
  {
    title: "One-Time Cleanup",
    price: "$25",
    description:
      "Need the yard cleaned up now? We'll take care of it.",
    included: "Starting price",
    additional: "Custom pricing for unusual jobs",
    popular: false,
  },
];

const serviceAreas = ["80916", "80915", "80917", "80910", "80909"];

const steps = [
  {
    number: "1",
    title: "Request a Quote",
    description:
      "Tell us about your dogs and choose an available time for your initial consultation.",
  },
  {
    number: "2",
    title: "Get Your Price",
    description:
      "We'll take a look at the yard and give you a straightforward price before recurring service begins.",
  },
  {
    number: "3",
    title: "We Scoop",
    description:
      "Choose your weekly or every-other-week schedule and let us handle the mess.",
  },
];

const faqs = [
  {
    question: "Is the first cleanup really free?",
    answer:
      "Yes! New customers who start a recurring service receive their first cleanup completely free.",
  },
  {
    question: "How much is each additional dog?",
    answer:
      "Our recurring service pricing includes one dog. Each additional dog is just $5 more per visit.",
  },
  {
    question: "Do you charge based on yard size?",
    answer:
      "Not normally. Standard recurring pricing is based on the number of dogs and how often we visit. Unusually large or heavily soiled yards may receive a custom quote.",
  },
  {
    question: "Is deodorizing included?",
    answer:
      "Deodorizing is an optional add-on and is not included in the standard scooping price.",
  },
  {
    question: "How much does deodorizing cost?",
    answer:
      "Weekly deodorizing is $15 per visit, bi-weekly deodorizing is $20 per visit, and one-time or spring deodorizing cleanups are $35–$45.",
  },
  {
    question: "How does scheduling work?",
    answer:
      "First, you'll choose an available time for your initial consultation. After you've received and accepted your quote, you'll be able to choose from available recurring service days and times.",
  },
  {
    question: "How often can you come?",
    answer:
      "We offer weekly, every-other-week, and twice-weekly recurring service, along with one-time cleanups.",
  },
];

export default function Home() {

  type AvailabilitySlot = {
    id: number
    available_date: string
    available_time: string
    appointment_type: string
    is_available: boolean
  }

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")

  useEffect(() => {
    const loadAvailability = async () => {
      const { data, error } = await supabase
        .from("availability")
        .select("id, available_date, available_time, appointment_type, is_available")
        .eq("appointment_type", "consultation")
        .eq("is_available", true)
        .gte("available_date", new Date().toISOString().split("T")[0])
        .order("available_date", { ascending: true })
        .order("available_time", { ascending: true })

      if (error) {
        console.error("Availability error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        setAvailability([])
      } else {
        setAvailability((data || []) as AvailabilitySlot[])
      }

      setLoadingAvailability(false)
    }

    loadAvailability()
  }, [])

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const availableDates = Array.from(
    new Set(availability.map((slot) => slot.available_date))
  )

  const timesForSelectedDate = availability.filter(
    (slot) => slot.available_date === selectedDate
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    const name = String(formData.get("name") || "").trim()
    const email = String(formData.get("email") || "").trim()
    const phone = String(formData.get("phone") || "").trim()
    const address = String(formData.get("address") || "").trim()
    const dogsValue = String(formData.get("dogs") || "").trim()
    const service = String(formData.get("service") || "").trim()
    const consultationDate = selectedDate
    const consultationTime = selectedTime
    const notes = String(formData.get("notes") || "").trim()

    if (
      !name ||
      !email ||
      !phone ||
      !address ||
      !dogsValue ||
      !service ||
      !consultationDate ||
      !consultationTime
    ) {
      alert("Please complete all required fields.")
      return
    }

    const selectedSlot = availability.find(
      (slot) =>
        slot.available_date === consultationDate &&
        slot.available_time.slice(0, 5) === consultationTime
    )

    if (!selectedSlot) {
      alert(
        "That consultation time is no longer available. Please choose another time."
      )
      return
    }

    const nameParts = name.split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(" ") || "Customer"
    const numberOfDogs = dogsValue === "5+" ? 5 : Number(dogsValue)

    if (!Number.isFinite(numberOfDogs) || numberOfDogs < 1) {
      alert("Please select a valid number of dogs.")
      return
    }

    const scheduledAt = new Date(
      `${consultationDate} ${consultationTime}`
    ).toISOString()

    const { error } = await supabase.rpc("submit_quote_request", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_phone: phone,
      p_email: email,
      p_address: address,
      p_zip_code: "",
      p_number_of_dogs: numberOfDogs,
      p_service: service,
      p_scheduled_at: scheduledAt,
      p_notes: notes || null,
    })

    if (error) {
      console.error("Quote submission error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })

      alert(
        `There was a problem submitting your request: ${error.message}`
      )
      return
    }

    const notificationResponse = await fetch("/api/send-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        address,
        dogs: dogsValue,
        service,
        consultationDate,
        consultationTime,
        notes,
      }),
    })

    if (!notificationResponse.ok) {
      const notificationResult = await notificationResponse.json().catch(() => null)

      console.error("Notification error:", notificationResult)

      alert(
        "Your quote request was booked successfully, but we could not send the business notification email. The appointment is still saved."
      )
    } else {
      alert("Thank you! Your free quote request has been submitted.")
    }

    form.reset()
    setSelectedDate("")
    setSelectedTime("")
  }

  return (
    <main className="min-h-screen bg-[#FEFBF7] text-[#0A1821]">

      {/* ==================== NAVIGATION ==================== */}
      <header className="sticky top-0 z-50 border-b border-[#0A1821]/10 bg-[#FEFBF7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">

          <a href="#" className="flex items-center">
            <img
              src="/dooty-done-logo.png"
              alt="Dooty Done Pet Waste Removal"
              className="h-16 w-auto object-contain"
            />
          </a>

          <nav className="hidden items-center gap-8 text-sm font-extrabold lg:flex">

            <a
              href="#services"
              className="transition hover:text-[#678739]"
            >
              Services
            </a>

            <a
              href="#pricing"
              className="transition hover:text-[#678739]"
            >
              Pricing
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-[#678739]"
            >
              How It Works
            </a>

            <a
              href="#faq"
              className="transition hover:text-[#678739]"
            >
              FAQ
            </a>

            <a
              href="#quote"
              className="transition hover:text-[#678739]"
            >
              Contact
            </a>

          </nav>

          <a
            href="#quote"
            className="rounded-full bg-[#678739] px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:bg-[#536f2e] hover:shadow-lg"
          >
            Get a Free Quote
          </a>

        </div>
      </header>


      {/* ==================== HERO ==================== */}
      <section className="relative min-h-[720px] overflow-hidden">

        <img
          src="/hero-photo.jpg"
          alt="Happy dog enjoying a Colorado Springs backyard"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Light fade behind left-side text */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FEFBF7]/94 via-[#FEFBF7]/55 to-transparent" />

        <div className="relative mx-auto min-h-[720px] max-w-7xl px-5 sm:px-8">

          {/* HERO TEXT */}
          <div className="relative z-20 flex min-h-[720px] items-center py-16 sm:py-20 lg:max-w-[59%]">

            <div className="max-w-2xl">

              <div className="mb-7 inline-flex rounded-full border border-[#678739]/25 bg-[#FEFBF7]/90 px-5 py-2.5 text-sm font-extrabold text-[#536f2e] shadow-sm backdrop-blur-sm">
                Colorado Springs' Local Dog Waste Removal
              </div>

              <h1 className="text-5xl font-black leading-[0.98] tracking-tight text-[#0A1821] sm:text-6xl lg:text-7xl xl:text-8xl">
                We Scoop.
                <br />
                <span className="text-[#678739]">
                  You Relax.
                </span>
              </h1>

              {/* Signature underline */}
              <div className="mt-6 h-2 w-28 rounded-full bg-[#678739]" />

              <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#0A1821]/85 sm:text-xl">
                Professional, reliable dog waste removal so you can enjoy a
                cleaner yard and more time with your dog.
              </p>

              {/* CTA Buttons */}
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">

                <a
                  href="#quote"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#678739] px-8 py-4 text-base font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#536f2e]"
                >
                  Get Your Free Quote
                  <span className="text-xl">→</span>
                </a>

                <a
                  href="#services"
                  className="inline-flex items-center justify-center rounded-full border-2 border-[#0A1821]/20 bg-[#FEFBF7]/95 px-8 py-4 text-base font-black text-[#0A1821] shadow-md backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#678739]"
                >
                  View Services
                </a>

              </div>

              {/* Hero benefits */}
              <div className="mt-9 grid gap-5 sm:grid-cols-3">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white shadow-md">
                    ✓
                  </div>

                  <div>
                    <p className="font-black">
                      Locally Owned
                    </p>

                    <p className="text-sm leading-5 text-[#0A1821]/65">
                      Proudly serving Colorado Springs
                    </p>
                  </div>

                </div>


                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white shadow-md">
                    ✓
                  </div>

                  <div>
                    <p className="font-black">
                      Flexible Scheduling
                    </p>

                    <p className="text-sm leading-5 text-[#0A1821]/65">
                      Weekly, biweekly or twice weekly
                    </p>
                  </div>

                </div>


                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white shadow-md">
                    ✦
                  </div>

                  <div>
                    <p className="font-black">
                      Optional Deodorizing
                    </p>

                    <p className="text-sm leading-5 text-[#0A1821]/65">
                      Add odor treatment when you want it
                    </p>
                  </div>

                </div>

              </div>

            </div>
          </div>


          {/* UPPER RIGHT LOGO */}
          <div className="pointer-events-none absolute right-0 top-0 z-30 hidden h-full w-[500px] lg:block">

            <img
              src="/dooty-done-logo-transparent.png"
              alt="Dooty Done Pet Waste Removal"
              className="absolute right-[-300px] top-6 w-[470px] object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.30)]"
            />

          </div>

        </div>
      </section>


      {/* ==================== FREE FIRST CLEANUP ==================== */}
      <section className="border-y-4 border-[#678739] bg-[#0A1821] text-white">

        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-10 text-center sm:px-8 md:flex-row md:justify-center md:text-left">

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#678739] text-3xl font-black shadow-lg">
            ✓
          </div>

          <div>

            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#A4C36B]">
              New Recurring Customers
            </p>

            <h2 className="mt-1 text-3xl font-black sm:text-4xl">
              Your first cleanup is{" "}
              <span className="text-[#A4C36B]">
                FREE.
              </span>
            </h2>

          </div>

          <div className="hidden h-12 w-px bg-white/25 md:block" />

          <p className="max-w-md text-white/85">
            Start a recurring service and we'll take care of the first
            cleanup on us.
          </p>

        </div>
      </section>


      {/* ==================== SERVICES / PRICING ==================== */}
      <section
        id="services"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8"
      >

        <div className="mx-auto max-w-3xl text-center">

          <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
            Our Services
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Pick the schedule that works for you.
          </h2>

          <p className="mt-5 text-lg leading-8 text-[#0A1821]/65">
            Straightforward pricing based on the number of dogs and the
            frequency you need.
          </p>

        </div>


        {/* SCOOPING PRICES */}
        <div
          id="pricing"
          className="mt-12 grid gap-5 sm:grid-cols-2"
        >

          {services.map((service) => (

            <div
              key={service.title}
              className={`relative rounded-3xl border bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                service.popular
                  ? "border-[#678739] ring-2 ring-[#678739]/10"
                  : "border-[#0A1821]/10"
              }`}
            >

              {service.popular && (
                <span className="absolute right-6 top-6 rounded-full bg-[#678739]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#536f2e]">
                  Most Popular
                </span>
              )}

              <h3 className="text-2xl font-black">
                {service.title}
              </h3>

              <div className="mt-5">

                <span className="text-4xl font-black text-[#678739]">
                  {service.price}
                </span>

                {service.title !== "One-Time Cleanup" && (
                  <span className="ml-2 font-semibold text-[#0A1821]/50">
                    / visit
                  </span>
                )}

              </div>

              <p className="mt-4 leading-7 text-[#0A1821]/65">
                {service.description}
              </p>

              <div className="mt-5 rounded-2xl bg-[#F1F5EA] p-4">

                <p className="font-extrabold text-[#0A1821]">
                  {service.included}
                </p>

                <p className="mt-1 text-lg font-black text-[#678739]">
                  {service.additional}
                </p>

              </div>

            </div>

          ))}

        </div>


        {/* CLEANUP SCALE */}
        <div className="mt-8 rounded-3xl border border-[#678739]/20 bg-[#F1F5EA] p-6">

          <h3 className="text-xl font-black">
            What can affect the price?
          </h3>

          <p className="mt-2 leading-7 text-[#0A1821]/70">
            Standard recurring pricing is based on the number of dogs and
            service frequency. We don't normally charge based on yard size.
            For unusually accumulated waste, we use a simple cleanup scale:
            <strong className="text-[#0A1821]">
              {" "}Light → Medium → Heavy → Extreme.
            </strong>
            {" "}If your yard needs additional cleanup beyond our standard
            service, we'll let you know the price before we begin.
          </p>

        </div>


        {/* OPTIONAL DEODORIZING */}
        <div className="mt-8 rounded-3xl border-2 border-[#678739]/20 bg-white p-8 shadow-sm">

          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

            <div className="max-w-2xl">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#678739] text-2xl text-white">
                  ✦
                </div>

                <div>

                  <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                    Optional Add-On
                  </p>

                  <h3 className="text-2xl font-black">
                    Fresh Yard Deodorizing
                  </h3>

                </div>

              </div>

              <p className="mt-4 leading-7 text-[#0A1821]/70">
                Add a deodorizer treatment to help reduce lingering
                pet-waste odors and keep your yard smelling fresher between
                cleanups. Deodorizing is completely optional and is not
                included in standard scooping prices.
              </p>

            </div>


            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-2xl">

              {/* WEEKLY */}
              <div className="rounded-2xl bg-[#F1F5EA] p-5 text-center">

                <p className="text-sm font-extrabold text-[#536f2e]">
                  WEEKLY
                </p>

                <p className="mt-2 text-3xl font-black text-[#678739]">
                  $15
                </p>

                <p className="mt-1 text-xs font-semibold text-[#0A1821]/60">
                  per visit
                </p>

                <p className="mt-3 text-xs leading-5 text-[#0A1821]/65">
                  Best for standard yards under 3,000 sq. ft.
                </p>

              </div>


              {/* BIWEEKLY */}
              <div className="rounded-2xl bg-[#F1F5EA] p-5 text-center">

                <p className="text-sm font-extrabold text-[#536f2e]">
                  BI-WEEKLY
                </p>

                <p className="mt-2 text-3xl font-black text-[#678739]">
                  $20
                </p>

                <p className="mt-1 text-xs font-semibold text-[#0A1821]/60">
                  per visit
                </p>

                <p className="mt-3 text-xs leading-5 text-[#0A1821]/65">
                  Heavier treatment for longer intervals between visits.
                </p>

              </div>


              {/* ONE TIME */}
              <div className="rounded-2xl bg-[#F1F5EA] p-5 text-center">

                <p className="text-sm font-extrabold text-[#536f2e]">
                  ONE-TIME / SPRING
                </p>

                <p className="mt-2 text-3xl font-black text-[#678739]">
                  $35–$45
                </p>

                <p className="mt-1 text-xs font-semibold text-[#0A1821]/60">
                  flat fee
                </p>

                <p className="mt-3 text-xs leading-5 text-[#0A1821]/65">
                  For neglected yards needing a heavier treatment.
                </p>

              </div>

            </div>

          </div>
        </div>

      </section>


      {/* ==================== HOW IT WORKS ==================== */}
      <section
        id="how-it-works"
        className="border-y border-[#678739]/15 bg-[#F5F7F1]"
      >

        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">

          <div className="mx-auto max-w-2xl text-center">

            <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
              How It Works
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Getting started is easy.
            </h2>

          </div>


          <div className="mt-14 grid gap-10 md:grid-cols-3">

            {steps.map((step) => (

              <div
                key={step.number}
                className="text-center"
              >

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#678739] text-2xl font-black text-white shadow-lg">
                  {step.number}
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {step.title}
                </h3>

                <p className="mx-auto mt-3 max-w-sm leading-7 text-[#0A1821]/65">
                  {step.description}
                </p>

              </div>

            ))}

          </div>

        </div>
      </section>


      {/* ==================== WHY DOOTY DONE ==================== */}
      <section className="bg-white">

        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">

          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

            <div>

              <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
                Why Dooty Done?
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                More Than Just a Scoop.
              </h2>

              <p className="mt-5 max-w-xl text-lg leading-8 text-[#0A1821]/65">
                We make keeping your yard clean simple. Reliable service,
                straightforward pricing, flexible scheduling, and optional
                deodorizing when you want it.
              </p>

            </div>


            <div className="grid gap-4 sm:grid-cols-2">

              {[
                {
                  title: "Reliable",
                  description:
                    "Consistent service you can count on.",
                },
                {
                  title: "Simple Pricing",
                  description:
                    "1 dog included, then just $5 per additional dog.",
                },
                {
                  title: "Optional Deodorizing",
                  description:
                    "Add odor treatment whenever you'd like.",
                },
                {
                  title: "Flexible",
                  description:
                    "Choose weekly, biweekly, or twice-weekly service.",
                },
              ].map((item) => (

                <div
                  key={item.title}
                  className="rounded-3xl border border-[#0A1821]/10 bg-[#FEFBF7] p-6 shadow-sm"
                >

                  <div className="h-2 w-12 rounded-full bg-[#678739]" />

                  <h3 className="mt-5 text-xl font-black">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#0A1821]/60">
                    {item.description}
                  </p>

                </div>

              ))}

            </div>

          </div>

        </div>
      </section>


      {/* ==================== SERVICE AREA ==================== */}
      <section className="bg-[#EAF0E2]">

        <div className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8">

          <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
            Service Area
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Serving Colorado Springs
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-[#0A1821]/65">
            Currently serving customers throughout these areas.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">

            {serviceAreas.map((zip) => (

              <span
                key={zip}
                className="rounded-full border border-[#678739]/25 bg-white px-5 py-2.5 font-black text-[#536f2e] shadow-sm"
              >
                {zip}
              </span>

            ))}

          </div>

        </div>
      </section>


      {/* ==================== FAQ ==================== */}
      <section
        id="faq"
        className="bg-white"
      >

        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8">

          <div className="text-center">

            <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
              FAQ
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight">
              Common Questions
            </h2>

          </div>


          <div className="mt-10 space-y-4">

            {faqs.map((faq) => (

              <details
                key={faq.question}
                className="group rounded-2xl border border-[#0A1821]/10 bg-[#FEFBF7] p-6"
              >

                <summary className="cursor-pointer list-none font-black">

                  {faq.question}

                  <span className="float-right text-2xl font-normal text-[#678739] transition-transform group-open:rotate-45">
                    +
                  </span>

                </summary>

                <p className="mt-4 leading-7 text-[#0A1821]/65">
                  {faq.answer}
                </p>

              </details>

            ))}

          </div>

        </div>
      </section>


      {/* ==================== FINAL QUOTE FORM ==================== */}
      <section
        id="quote"
        className="border-t-4 border-[#678739] bg-[#0A1821] text-white"
      >

        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">

          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">

            {/* LEFT SIDE */}
            <div>

              <p className="font-extrabold uppercase tracking-[0.18em] text-[#A4C36B]">
                Get Started
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Let's get that yard{" "}
                <span className="text-[#A4C36B]">
                  Dooty Done.
                </span>
              </h2>

              <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">
                Tell us a little about your yard and your dogs, then choose a
                convenient time for your free quote visit.
              </p>


              {/* Process */}
              <div className="mt-8 space-y-5">

                <div className="flex items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white">
                    1
                  </div>

                  <div>
                    <p className="font-black">
                      Tell Us About Your Yard
                    </p>

                    <p className="text-sm leading-6 text-white/60">
                      A few quick details help us prepare for your visit.
                    </p>
                  </div>

                </div>


                <div className="flex items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white">
                    2
                  </div>

                  <div>
                    <p className="font-black">
                      Choose a Quote Time
                    </p>

                    <p className="text-sm leading-6 text-white/60">
                      Pick from the consultation times we make available.
                    </p>
                  </div>

                </div>


                <div className="flex items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white">
                    3
                  </div>

                  <div>
                    <p className="font-black">
                      We'll Handle the Rest
                    </p>

                    <p className="text-sm leading-6 text-white/60">
                      We'll evaluate the yard and give you your price.
                    </p>
                  </div>

                </div>

              </div>

            </div>


            {/* RIGHT SIDE — FORM */}
            <div className="rounded-[2rem] bg-[#FEFBF7] p-6 text-[#0A1821] shadow-2xl sm:p-8">

              <div className="mb-7">

                <h3 className="text-2xl font-black">
                  Request Your Free Quote
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#0A1821]/60">
                  New recurring customers receive their first cleanup free.
                </p>

              </div>


              <form
  className="space-y-5"
  onSubmit={handleSubmit}
>

                {/* NAME */}
                <div>

                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  />

                </div>


                {/* EMAIL */}
                <div>

                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  />

                </div>


                {/* PHONE */}
                <div>

                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Phone
                  </label>

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="(719) 555-1234"
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  />

                </div>


                {/* ADDRESS */}
                <div>

                  <label
                    htmlFor="address"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Service Address
                  </label>

                  <input
                    id="address"
                    name="address"
                    type="text"
                    required
                    placeholder="Street address, Colorado Springs"
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  />

                </div>


                {/* DOGS + SERVICE */}
                <div className="grid gap-5 sm:grid-cols-2">

                  <div>

                    <label
                      htmlFor="dogs"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Number of Dogs
                    </label>

                    <select
                      id="dogs"
                      name="dogs"
                      required
                      defaultValue=""
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                    >

                      <option value="" disabled>
                        Select
                      </option>

                      <option value="1">
                        1 dog
                      </option>

                      <option value="2">
                        2 dogs
                      </option>

                      <option value="3">
                        3 dogs
                      </option>

                      <option value="4">
                        4 dogs
                      </option>

                      <option value="5+">
                        5+ dogs
                      </option>

                    </select>

                  </div>


                  <div>

                    <label
                      htmlFor="service"
                      className="mb-2 block text-sm font-extrabold"
                    >
                      Service
                    </label>

                    <select
                      id="service"
                      name="service"
                      required
                      defaultValue=""
                      className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                    >

                      <option value="" disabled>
                        Select
                      </option>

                      <option value="weekly">
                        Weekly
                      </option>

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

                </div>


                {/* CONSULTATION */}
                <div className="rounded-3xl border border-[#678739]/20 bg-[#F1F5EA] p-5">

                  <div className="mb-5">

                    <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                      Free Quote Visit
                    </p>

                    <h4 className="mt-1 text-xl font-black">
                      Choose Your Consultation Time
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-[#0A1821]/60">
                      Choose from the dates and times we have available.
                    </p>

                  </div>


                  <div className="grid gap-5 sm:grid-cols-2">

                    <div>

                      <label
                        htmlFor="consultation-date"
                        className="mb-2 block text-sm font-extrabold"
                      >
                        Date
                      </label>

                      <select
                        id="consultation-date"
                        name="consultation-date"
                        required
                        value={selectedDate}
                        onChange={(event) => {
                          setSelectedDate(event.target.value)
                          setSelectedTime("")
                        }}
                        disabled={loadingAvailability || availableDates.length === 0}
                        className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="" disabled>
                          {loadingAvailability
                            ? "Loading dates..."
                            : availableDates.length === 0
                              ? "No dates available"
                              : "Select a date"}
                        </option>

                        {availableDates.map((date) => {
                          const [year, month, day] = date.split("-").map(Number)
                          const displayDate = new Date(year, month - 1, day).toLocaleDateString(
                            [],
                            {
                              weekday: "short",
                              month: "long",
                              day: "numeric",
                            }
                          )

                          return (
                            <option key={date} value={date}>
                              {displayDate}
                            </option>
                          )
                        })}
                      </select>

                    </div>


                    <div>

                      <label
                        htmlFor="consultation-time"
                        className="mb-2 block text-sm font-extrabold"
                      >
                        Available Time
                      </label>

                      <select
                        id="consultation-time"
                        name="consultation-time"
                        required
                        value={selectedTime}
                        onChange={(event) => setSelectedTime(event.target.value)}
                        disabled={loadingAvailability || !selectedDate || timesForSelectedDate.length === 0}
                        className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="" disabled>
                          {!selectedDate
                            ? "Choose a date first"
                            : timesForSelectedDate.length === 0
                              ? "No times available"
                              : "Select a time"}
                        </option>

                        {timesForSelectedDate.map((slot) => (
                          <option
                            key={slot.id}
                            value={slot.available_time.slice(0, 5)}
                          >
                            {formatTime(slot.available_time)}
                          </option>
                        ))}
                      </select>

                    </div>

                  </div>


                  <p className="mt-3 text-xs leading-5 text-[#0A1821]/55">
                    These times are based on Dooty Done's current availability.
                    Once a consultation is booked, that time is removed from the available slots.
                  </p>

                </div>


                {/* NOTES */}
                <div>

                  <label
                    htmlFor="notes"
                    className="mb-2 block text-sm font-extrabold"
                  >
                    Anything else we should know?
                  </label>

                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    placeholder="Gate information, yard details, special instructions, etc."
                    className="w-full resize-none rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
                  />

                </div>


                {/* SUBMIT */}
                <button
                  type="submit"
                  className="w-full rounded-full bg-[#678739] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#536f2e]"
                >
                  Request My Free Quote →
                </button>


                <p className="text-center text-xs leading-5 text-[#0A1821]/50">
                  Your information will be used only to contact you about your
                  Dooty Done quote and service.
                </p>

              </form>

            </div>

          </div>

        </div>
      </section>


      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-[#678739]/15 bg-[#FEFBF7]">

        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-[#0A1821]/60 sm:px-8 md:flex-row md:items-center md:justify-between">

          <p>
            © {new Date().getFullYear()} Dooty Done LLC. All rights reserved.
          </p>

          <p className="font-semibold">
            Colorado Springs, Colorado
          </p>

        </div>
      </footer>

    </main>
  );
}