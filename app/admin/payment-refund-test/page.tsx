"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

type Payment = {
  id: number
  customer_id: number | null
  customer_service_id: number | null
  job_id: number | null
  amount: number
  status: string
  payment_method: string
  square_payment_id: string | null
  receipt_url: string | null
  paid_at: string | null
}

type Customer = {
  id: number
  first_name: string
  last_name: string
  email: string | null
}

type RefundResult = {
  id: number
  paymentId: number
  amount: number
  status: string
  squareRefundId: string | null
  reason: string | null
  createdAt: string
  processedAt: string | null
}

export default function PaymentRefundTestPage() {
  const router = useRouter()

  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedPaymentId, setSelectedPaymentId] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [reason, setReason] = useState("Sandbox refund test")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [refundResult, setRefundResult] = useState<RefundResult | null>(null)

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
        { data: paymentData, error: paymentError },
        { data: customerData, error: customerError },
      ] = await Promise.all([
        supabase
          .from("payments")
          .select(
            "id, customer_id, customer_service_id, job_id, amount, status, payment_method, square_payment_id, receipt_url, paid_at"
          )
          .eq("status", "paid")
          .eq("payment_method", "square_card")
          .not("square_payment_id", "is", null)
          .order("paid_at", { ascending: false })
          .limit(50),

        supabase
          .from("customers")
          .select("id, first_name, last_name, email"),
      ])

      if (paymentError || customerError) {
        console.error("Payment refund test load error:", {
          paymentError,
          customerError,
        })

        setErrorMessage("We couldn't load the payment refund test data.")
      } else {
        setPayments((paymentData || []) as Payment[])
        setCustomers((customerData || []) as Customer[])

        const loadedPayments = (paymentData || []) as Payment[]

        if (loadedPayments.length > 0) {
          const firstPayment = loadedPayments[0]

          setSelectedPaymentId(String(firstPayment.id))
          setRefundAmount(
            Math.min(Number(firstPayment.amount), 5).toFixed(2)
          )
        }
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const selectedPayment =
    payments.find(
      (payment) => payment.id === Number(selectedPaymentId)
    ) || null

  const selectedCustomer = selectedPayment?.customer_id
    ? customers.find(
        (customer) => customer.id === selectedPayment.customer_id
      ) || null
    : null

  const handlePaymentChange = (paymentId: string) => {
    setSelectedPaymentId(paymentId)
    setSuccessMessage("")
    setErrorMessage("")
    setRefundResult(null)

    const payment =
      payments.find((item) => item.id === Number(paymentId)) || null

    if (payment) {
      setRefundAmount(
        Math.min(Number(payment.amount), 5).toFixed(2)
      )
    } else {
      setRefundAmount("")
    }
  }

  const handleRefundTest = async () => {
    setErrorMessage("")
    setSuccessMessage("")
    setRefundResult(null)

    if (!selectedPayment) {
      setErrorMessage("Please choose a paid Square payment first.")
      return
    }

    const amount = Number(refundAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Please enter a valid refund amount.")
      return
    }

    if (amount > Number(selectedPayment.amount)) {
      setErrorMessage(
        `The refund cannot exceed the original payment of $${Number(
          selectedPayment.amount
        ).toFixed(2)}.`
      )
      return
    }

    const confirmed = window.confirm(
      `Refund $${amount.toFixed(
        2
      )} from the $${Number(
        selectedPayment.amount
      ).toFixed(
        2
      )} Square Sandbox payment for ${
        selectedCustomer
          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          : "this customer"
      }?\n\nThis is Sandbox only and will not refund real money.`
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

      const response = await fetch("/api/square-refund-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          amount,
          reason: reason.trim() || "Dooty Done Sandbox refund test",
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        console.error("Square refund test error:", result)

        setErrorMessage(
          result?.error || "Square could not process the test refund."
        )
        return
      }

      setRefundResult(result.refund as RefundResult)

      setSuccessMessage(
        `Success! Square Sandbox accepted a $${Number(
          result.refund?.amount || amount
        ).toFixed(2)} refund.`
      )
    } catch (error) {
      console.error("Square refund test unexpected error:", error)

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't run the test refund."
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
            Test Payment Refund
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#0A1821]/60">
            This temporary page tests refunding a completed Dooty Done
            Square Sandbox payment. No real customer card or real money
            will be affected.
          </p>

          {loading ? (
            <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold">
              Loading paid Sandbox payments...
            </div>
          ) : (
            <>
              <div className="mt-8">
                <label className="text-sm font-black">
                  Paid Square Payment
                </label>

                <select
                  value={selectedPaymentId}
                  onChange={(event) =>
                    handlePaymentChange(event.target.value)
                  }
                  disabled={busy}
                  className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                >
                  <option value="">
                    Choose a paid Square payment
                  </option>

                  {payments.map((payment) => {
                    const customer = payment.customer_id
                      ? customers.find(
                          (item) => item.id === payment.customer_id
                        )
                      : null

                    return (
                      <option key={payment.id} value={payment.id}>
                        Payment #{payment.id} —{" "}
                        {customer
                          ? `${customer.first_name} ${customer.last_name}`
                          : "Customer"}{" "}
                        — $
                        {Number(payment.amount).toFixed(2)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {selectedPayment && (
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
                    Payment #{selectedPayment.id}
                  </p>

                  <p className="mt-1 text-sm text-[#0A1821]/60">
                    Original payment: $
                    {Number(selectedPayment.amount).toFixed(2)}
                  </p>

                  <p className="mt-1 text-sm text-[#0A1821]/60">
                    Status: {selectedPayment.status}
                  </p>

                  <p className="mt-1 break-all text-xs text-[#0A1821]/50">
                    Square Payment ID:{" "}
                    {selectedPayment.square_payment_id}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label className="text-sm font-black">
                  Refund Amount
                </label>

                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0A1821]/50">
                    $
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundAmount}
                    onChange={(event) => {
                      setRefundAmount(event.target.value)
                      setSuccessMessage("")
                      setErrorMessage("")
                      setRefundResult(null)
                    }}
                    disabled={busy || !selectedPayment}
                    className="w-full rounded-2xl border border-[#0A1821]/15 bg-white py-3 pl-8 pr-4 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                    placeholder="5.00"
                  />
                </div>

                <p className="mt-2 text-xs text-[#0A1821]/50">
                  For our first test, use $5.00.
                </p>
              </div>

              <div className="mt-6">
                <label className="text-sm font-black">
                  Refund Reason
                </label>

                <input
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                  maxLength={192}
                  className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                  placeholder="Reason for refund"
                />
              </div>

              <button
                type="button"
                onClick={handleRefundTest}
                disabled={!selectedPayment || busy}
                className="mt-6 w-full rounded-full bg-[#678739] px-5 py-4 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Refunding Sandbox..."
                  : "Refund Sandbox Payment"}
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

              {refundResult && (
                <div className="mt-5 rounded-2xl border border-[#0A1821]/10 bg-white p-5">
                  <p className="text-sm font-black">
                    Refund Record
                  </p>

                  <p className="mt-3 text-sm">
                    <strong>Amount:</strong> $
                    {Number(refundResult.amount).toFixed(2)}
                  </p>

                  <p className="mt-1 text-sm">
                    <strong>Status:</strong>{" "}
                    {refundResult.status}
                  </p>

                  <p className="mt-1 text-sm">
                    <strong>Reason:</strong>{" "}
                    {refundResult.reason || "None"}
                  </p>

                  {refundResult.squareRefundId && (
                    <p className="mt-1 break-all text-xs text-[#0A1821]/50">
                      Square Refund ID:{" "}
                      {refundResult.squareRefundId}
                    </p>
                  )}

                  {refundResult.processedAt && (
                    <p className="mt-1 text-xs text-[#0A1821]/50">
                      Processed:{" "}
                      {new Date(
                        refundResult.processedAt
                      ).toLocaleString()}
                    </p>
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