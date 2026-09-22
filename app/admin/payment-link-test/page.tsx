"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

type Customer = {
  id: number
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

type PaymentLinkResult = {
  id: string
  url: string
  longUrl: string | null
  orderId: string | null
  amount: number
  name: string
  description: string
  customerId: number | null
  createdAt: string | null
}

export default function PaymentLinkTestPage() {
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [amount, setAmount] = useState("45.00")
  const [name, setName] = useState("Dooty Done One-Time Cleanup")
  const [description, setDescription] = useState(
    "One-time dog waste cleanup service from Dooty Done."
  )
  const [paymentNote, setPaymentNote] = useState(
    "Thank you for choosing Dooty Done!"
  )

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [paymentLinkResult, setPaymentLinkResult] =
    useState<PaymentLinkResult | null>(null)

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

      const { data: customerData, error: customerError } =
        await supabase
          .from("customers")
          .select(
            "id, first_name, last_name, email, phone"
          )
          .order("first_name", { ascending: true })
          .limit(100)

      if (customerError) {
        console.error(
          "Payment link customer load error:",
          customerError
        )

        setErrorMessage(
          "We couldn't load your customers."
        )
      } else {
        const loadedCustomers =
          (customerData || []) as Customer[]

        setCustomers(loadedCustomers)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.id === Number(selectedCustomerId)
    ) || null

  const handleCreatePaymentLink = async () => {
    setErrorMessage("")
    setSuccessMessage("")
    setPaymentLinkResult(null)

    const numericAmount = Number(amount)

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setErrorMessage(
        "Please enter a valid payment amount."
      )
      return
    }

    if (!name.trim()) {
      setErrorMessage(
        "Please enter a payment name."
      )
      return
    }

    const confirmed = window.confirm(
      `Create a $${numericAmount.toFixed(
        2
      )} Square Sandbox payment link for ${
        selectedCustomer
          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          : "a customer"
      }?\n\nThis creates a Sandbox checkout link and does not charge anyone yet.`
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        setErrorMessage(
          "Your admin session could not be verified. Please log in again."
        )
        return
      }

      const response = await fetch(
        "/api/square-create-payment-link",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            amount: numericAmount,
            name: name.trim(),
            description: description.trim(),
            paymentNote: paymentNote.trim(),
            customerId:
              selectedCustomerId
                ? Number(selectedCustomerId)
                : null,
          }),
        }
      )

      const result = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        console.error(
          "Square payment link test error:",
          result
        )

        setErrorMessage(
          result?.error ||
            "Square could not create the payment link."
        )
        return
      }

      setPaymentLinkResult(
        result.paymentLink as PaymentLinkResult
      )

      setSuccessMessage(
        "Success! Your Square Sandbox payment link was created."
      )
    } catch (error) {
      console.error(
        "Payment link test unexpected error:",
        error
      )

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't create the payment link."
      )
    } finally {
      setBusy(false)
    }
  }

  const handleCopyLink = async () => {
    if (!paymentLinkResult?.url) return

    try {
      await navigator.clipboard.writeText(
        paymentLinkResult.url
      )

      setSuccessMessage(
        "Payment link copied to your clipboard."
      )
    } catch {
      setErrorMessage(
        "We couldn't copy the link automatically. You can select and copy it manually."
      )
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
            Create Payment Link
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#0A1821]/60">
            This temporary page creates a Square Sandbox
            checkout link that you can send to a customer.
            Creating the link does not charge anyone.
          </p>

          {loading ? (
            <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold">
              Loading customers...
            </div>
          ) : (
            <>
              <div className="mt-8">
                <label className="text-sm font-black">
                  Customer
                </label>

                <select
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(
                      event.target.value
                    )
                    setSuccessMessage("")
                    setErrorMessage("")
                    setPaymentLinkResult(null)
                  }}
                  disabled={busy}
                  className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                >
                  <option value="">
                    No customer / general payment
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.first_name}{" "}
                      {customer.last_name}
                      {customer.email
                        ? ` — ${customer.email}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="mt-4 rounded-2xl bg-[#F1F5EA] p-4">
                  <p className="text-sm font-black">
                    {selectedCustomer.first_name}{" "}
                    {selectedCustomer.last_name}
                  </p>

                  <p className="mt-1 text-sm text-[#0A1821]/60">
                    {selectedCustomer.email ||
                      "No email on file"}
                  </p>

                  <p className="mt-1 text-sm text-[#0A1821]/60">
                    {selectedCustomer.phone ||
                      "No phone on file"}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label className="text-sm font-black">
                  Amount
                </label>

                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0A1821]/50">
                    $
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => {
                      setAmount(
                        event.target.value
                      )
                      setSuccessMessage("")
                      setErrorMessage("")
                      setPaymentLinkResult(null)
                    }}
                    disabled={busy}
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white py-3 pl-8 pr-4 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="text-sm font-black">
                  Payment Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setSuccessMessage("")
                    setErrorMessage("")
                    setPaymentLinkResult(null)
                  }}
                  disabled={busy}
                  maxLength={500}
                  className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                />
              </div>

              <div className="mt-6">
                <label className="text-sm font-black">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) => {
                    setDescription(
                      event.target.value
                    )
                    setSuccessMessage("")
                    setErrorMessage("")
                    setPaymentLinkResult(null)
                  }}
                  disabled={busy}
                  maxLength={4096}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                />
              </div>

              <div className="mt-6">
                <label className="text-sm font-black">
                  Payment Note
                </label>

                <input
                  type="text"
                  value={paymentNote}
                  onChange={(event) => {
                    setPaymentNote(
                      event.target.value
                    )
                    setSuccessMessage("")
                    setErrorMessage("")
                    setPaymentLinkResult(null)
                  }}
                  disabled={busy}
                  maxLength={500}
                  className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                />
              </div>

              <button
                type="button"
                onClick={
                  handleCreatePaymentLink
                }
                disabled={busy}
                className="mt-6 w-full rounded-full bg-[#678739] px-5 py-4 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Creating Sandbox Link..."
                  : "Create Payment Link"}
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

              {paymentLinkResult && (
                <div className="mt-5 rounded-2xl border border-[#0A1821]/10 bg-white p-5">
                  <p className="text-sm font-black">
                    Payment Link Created
                  </p>

                  <p className="mt-3 text-sm">
                    <strong>Amount:</strong> $
                    {Number(
                      paymentLinkResult.amount
                    ).toFixed(2)}
                  </p>

                  <p className="mt-1 text-sm">
                    <strong>Name:</strong>{" "}
                    {paymentLinkResult.name}
                  </p>

                  {paymentLinkResult.orderId && (
                    <p className="mt-1 break-all text-xs text-[#0A1821]/50">
                      Square Order ID:{" "}
                      {paymentLinkResult.orderId}
                    </p>
                  )}

                  <div className="mt-4 rounded-2xl bg-[#F1F5EA] p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-[#536f2e]">
                      Customer Payment Link
                    </p>

                    <a
                      href={
                        paymentLinkResult.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-sm font-bold text-[#678739] hover:underline"
                    >
                      {paymentLinkResult.url}
                    </a>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={
                        handleCopyLink
                      }
                      className="rounded-full bg-[#678739] px-5 py-3 text-sm font-black text-white transition hover:bg-[#536f2e]"
                    >
                      Copy Payment Link
                    </button>

                    <a
                      href={
                        paymentLinkResult.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#0A1821]/15 px-5 py-3 text-center text-sm font-black transition hover:bg-[#F1F5EA]"
                    >
                      Open Checkout
                    </a>
                  </div>
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