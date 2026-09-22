"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

type Job = {
  id: number
  scheduled_for: string
  status: string
  customer_service_id: number
}

type CustomerService = {
  id: number
  customer_id: number
  agreed_price: number
}

type Customer = {
  id: number
  first_name: string
  last_name: string
  email: string | null
}

type PaymentResult = {
  id: number
  jobId: number
  amount: number
  status: string
  squarePaymentId: string | null
  receiptUrl: string | null
  cardBrand: string | null
  last4: string | null
}

export default function PaymentChargeTestPage() {
  const router = useRouter()

  const [jobs, setJobs] = useState<Job[]>([])
  const [customerServices, setCustomerServices] = useState<CustomerService[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedJobId, setSelectedJobId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)

  useEffect(() => {
    const loadData = async () => {
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

      const [
        { data: jobData, error: jobError },
        { data: customerServiceData, error: customerServiceError },
        { data: customerData, error: customerError },
      ] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, scheduled_for, status, customer_service_id")
          .eq("status", "completed")
          .order("scheduled_for", { ascending: false })
          .limit(50),

        supabase
          .from("customer_services")
          .select("id, customer_id, agreed_price"),

        supabase
          .from("customers")
          .select("id, first_name, last_name, email"),
      ])

      if (jobError || customerServiceError || customerError) {
        console.error("Payment charge test load error:", {
          jobError,
          customerServiceError,
          customerError,
        })

        setErrorMessage("We couldn't load the payment test data.")
      } else {
        const loadedJobs = (jobData || []) as Job[]
        setJobs(loadedJobs)
        setCustomerServices((customerServiceData || []) as CustomerService[])
        setCustomers((customerData || []) as Customer[])

        if (loadedJobs.length > 0) {
          setSelectedJobId(String(loadedJobs[0].id))
        }
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const getCustomerService = (job: Job | null) => {
    if (!job) return null

    return (
      customerServices.find(
        (customerService) => customerService.id === job.customer_service_id
      ) || null
    )
  }

  const getCustomer = (job: Job | null) => {
    const customerService = getCustomerService(job)

    if (!customerService) return null

    return (
      customers.find(
        (customer) => customer.id === customerService.customer_id
      ) || null
    )
  }

  const selectedJob =
    jobs.find((job) => job.id === Number(selectedJobId)) || null

  const selectedCustomerService = getCustomerService(selectedJob)
  const selectedCustomer = getCustomer(selectedJob)

  const handleChargeTestJob = async () => {
    setErrorMessage("")
    setSuccessMessage("")
    setPaymentResult(null)

    if (!selectedJob) {
      setErrorMessage("Please choose a completed job first.")
      return
    }

    const confirmed = window.confirm(
      `Charge the Square Sandbox card on file for ${selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : "this customer"} $${Number(selectedCustomerService?.agreed_price || 0).toFixed(2)}? This is Sandbox only and will not charge a real card.`
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        setErrorMessage(
          "Your admin session could not be verified. Please log in again."
        )
        return
      }

      const response = await fetch("/api/square-charge-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId: selectedJob.id,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        console.error("Square charge test error:", result)

        setErrorMessage(
          result?.error || "Square could not process the test payment."
        )
        return
      }

      if (result?.alreadyPaid) {
        setSuccessMessage(
          "This job already has a payment record, so it was not charged again."
        )
        setPaymentResult(result.payment as PaymentResult)
        return
      }

      setPaymentResult(result.payment as PaymentResult)

      setSuccessMessage(
        `Success! Square Sandbox charged $${Number(result.payment?.amount || 0).toFixed(2)} to the saved test card.`
      )
    } catch (error) {
      console.error("Square charge test unexpected error:", error)

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't run the test payment."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FEFBF7] px-5 py-10 text-[#0A1821] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
          <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
            Square Sandbox
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Test Job Charge
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#0A1821]/60">
            This temporary page tests charging a completed Dooty Done job
            using the customer's saved Square Sandbox card.
          </p>

          {loading ? (
            <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold">
              Loading completed jobs...
            </div>
          ) : (
            <>
              <div className="mt-8">
                <label className="text-sm font-black">
                  Completed Job
                </label>

                <select
                  value={selectedJobId}
                  onChange={(event) => {
                    setSelectedJobId(event.target.value)
                    setSuccessMessage("")
                    setErrorMessage("")
                    setPaymentResult(null)
                  }}
                  disabled={busy}
                  className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                >
                  <option value="">
                    Choose a completed job
                  </option>

                  {jobs.map((job) => {
                    const customerService = customerServices.find(
                      (item) => item.id === job.customer_service_id
                    )

                    const customer = customerService
                      ? customers.find(
                          (item) => item.id === customerService.customer_id
                        )
                      : null

                    return (
                      <option key={job.id} value={job.id}>
                        Job #{job.id} —{" "}
                        {customer
                          ? `${customer.first_name} ${customer.last_name}`
                          : "Customer"}{" "}
                        — $
                        {Number(
                          customerService?.agreed_price || 0
                        ).toFixed(2)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {selectedJob && (
                <div className="mt-6 rounded-2xl bg-[#F1F5EA] p-5">
                  <p className="text-sm font-black">
                    {selectedCustomer
                      ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                      : "Customer"}
                  </p>

                  <p className="mt-1 text-sm text-[#0A1821]/60">
                    {selectedCustomer?.email || "No email on file"}
                  </p>

                  <p className="mt-3 text-sm font-bold text-[#536f2e]">
                    Job #{selectedJob.id}
                  </p>

                  <p className="mt-1 text-sm text-[#0A1821]/60">
                    Completed{" "}
                    {new Date(
                      selectedJob.scheduled_for
                    ).toLocaleString()}
                  </p>

                  <p className="mt-3 text-lg font-black">
                    Charge: $
                    {Number(
                      selectedCustomerService?.agreed_price || 0
                    ).toFixed(2)}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleChargeTestJob}
                disabled={!selectedJob || busy}
                className="mt-6 w-full rounded-full bg-[#678739] px-5 py-4 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Charging Sandbox..." : "Charge Test Job"}
              </button>

              {successMessage && (
                <div className="mt-5 rounded-2xl bg-[#F1F5EA] p-4 text-sm font-bold text-[#536f2e]">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {errorMessage}
                </div>
              )}

              {paymentResult && (
                <div className="mt-5 rounded-2xl border border-[#0A1821]/10 bg-white p-5">
                  <p className="text-sm font-black">
                    Payment Record
                  </p>

                  <p className="mt-3 text-sm">
                    <strong>Amount:</strong> $
                    {Number(paymentResult.amount).toFixed(2)}
                  </p>

                  <p className="mt-1 text-sm">
                    <strong>Status:</strong> {paymentResult.status}
                  </p>

                  {paymentResult.cardBrand && paymentResult.last4 && (
                    <p className="mt-1 text-sm">
                      <strong>Card:</strong>{" "}
                      {paymentResult.cardBrand} ••••{" "}
                      {paymentResult.last4}
                    </p>
                  )}

                  {paymentResult.squarePaymentId && (
                    <p className="mt-1 break-all text-xs text-[#0A1821]/50">
                      Square Payment ID:{" "}
                      {paymentResult.squarePaymentId}
                    </p>
                  )}

                  {paymentResult.receiptUrl && (
                    <a
                      href={paymentResult.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block text-sm font-black text-[#678739] hover:underline"
                    >
                      Open Square receipt
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => router.push("/admin")}
            disabled={busy}
            className="mt-6 text-sm font-black text-[#678739] hover:underline disabled:opacity-50"
          >
            ← Back to Admin Dashboard
          </button>
        </div>
      </div>
    </main>
  )
}
