"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

type SquareCard = {
  attach: (selector: string) => Promise<void>
  tokenize: (verificationDetails: {
    intent: "STORE"
    billingContact: {
      givenName: string
      familyName: string
      email: string
      phone: string
      addressLines: string[]
      city: string
      state: string
      countryCode: string
      postalCode: string
    }
    customerInitiated: boolean
    sellerKeyedIn: boolean
  }) => Promise<{
    status: string
    token?: string
    errors?: unknown[]
  }>
  destroy?: () => void
}

type SquarePayments = {
  card: () => Promise<SquareCard>
}

type SquareGlobal = {
  payments: (
    applicationId: string,
    locationId: string
  ) => SquarePayments
}

declare global {
  interface Window {
    Square?: SquareGlobal
  }
}

type Customer = {
  id: number
  first_name: string
  last_name: string
  email: string | null
  phone: string
  address: string
  zip_code: string
}

export default function PaymentTestPage() {
  const router = useRouter()

  const cardRef = useRef<SquareCard | null>(null)

  const [loading, setLoading] = useState(true)
  const [scriptReady, setScriptReady] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [cardReady, setCardReady] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    const loadCustomers = async () => {
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

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, email, phone, address, zip_code"
        )
        .order("id", { ascending: false })

      if (error) {
        console.error("Load payment test customers error:", error)
        setErrorMessage("We couldn't load your customers.")
      } else {
        setCustomers((data || []) as Customer[])

        if (data && data.length > 0) {
          setSelectedCustomerId(String(data[0].id))
        }
      }

      setLoading(false)
    }

    loadCustomers()
  }, [router])

  useEffect(() => {
    if (!scriptReady || loading) return

    const initializeSquareCard = async () => {
      try {
        if (!window.Square) {
          throw new Error("Square.js did not load.")
        }

        const applicationId =
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID

        const locationId =
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID

        if (!applicationId || !locationId) {
          throw new Error(
            "Square Application ID or Location ID is missing."
          )
        }

        const payments = window.Square.payments(
          applicationId,
          locationId
        )

        const card = await payments.card()

        await card.attach("#square-card-container")

        cardRef.current = card
        setCardReady(true)
      } catch (error) {
        console.error("Square card initialization error:", error)

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We couldn't load the Square card form."
        )
      }
    }

    initializeSquareCard()

    return () => {
      cardRef.current?.destroy?.()
      cardRef.current = null
    }
  }, [scriptReady, loading])

  const handleSaveTestCard = async () => {
    setErrorMessage("")
    setSuccessMessage("")

    if (!selectedCustomerId) {
      setErrorMessage("Please choose a customer first.")
      return
    }

    if (!consentGiven) {
      setErrorMessage(
        "Please confirm that the customer gave permission to save the card."
      )
      return
    }

    if (!cardRef.current || !cardReady) {
      setErrorMessage("The Square card form is not ready yet.")
      return
    }

    const customer = customers.find(
      (item) => item.id === Number(selectedCustomerId)
    )

    if (!customer) {
      setErrorMessage("The selected customer could not be found.")
      return
    }

    if (!customer.email) {
      setErrorMessage(
        "This customer needs an email address before testing card setup."
      )
      return
    }

    const nameParts = `${customer.first_name} ${customer.last_name}`
      .trim()
      .split(/\s+/)

    const givenName = nameParts[0] || customer.first_name
    const familyName =
      nameParts.slice(1).join(" ") || customer.last_name

    const postalCode = customer.zip_code?.trim() || "80909"

    setBusy(true)

    try {
      const tokenResult = await cardRef.current.tokenize({
        intent: "STORE",
        billingContact: {
          givenName,
          familyName,
          email: customer.email,
          phone: customer.phone || "",
          addressLines: [customer.address || "Test Address"],
          city: "Colorado Springs",
          state: "CO",
          countryCode: "US",
          postalCode,
        },
        customerInitiated: true,
        sellerKeyedIn: false,
      })

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        console.error(
          "Square tokenization result:",
          tokenResult
        )

        setErrorMessage(
          tokenResult.errors
            ? `Card tokenization failed: ${JSON.stringify(
                tokenResult.errors
              )}`
            : `Card tokenization failed with status: ${tokenResult.status}`
        )

        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        console.error(
          "Payment test session error:",
          sessionError
        )

        setErrorMessage(
          "Your admin session could not be verified. Please log in again."
        )

        return
      }

      const response = await fetch("/api/square-save-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          customerId: customer.id,
          sourceId: tokenResult.token,
          consentGiven: true,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        console.error("Square save card error:", result)

        setErrorMessage(
          result?.error ||
            "Square could not save the card on file."
        )

        return
      }

      if (result?.success) {
        setSuccessMessage(
          `Success! The test card is now saved on file for ${customer.first_name} ${customer.last_name}. Nothing was charged.`
        )
      } else {
        setErrorMessage(
          "The card setup did not complete as expected."
        )
      }
    } catch (error) {
      console.error("Square save card unexpected error:", error)

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't save the test card."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Script
        src="https://sandbox.web.squarecdn.com/v1/square.js"
        onLoad={() => setScriptReady(true)}
      />

      <main className="min-h-screen bg-[#FEFBF7] px-5 py-10 text-[#0A1821] sm:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-sm sm:p-8">
            <p className="font-extrabold uppercase tracking-[0.15em] text-[#678739]">
              Square Sandbox
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Test Card Setup
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#0A1821]/60">
              This is a temporary developer test page. It uses
              Square's Sandbox and will not charge a real card.
            </p>

            {loading ? (
              <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5 text-sm font-semibold">
                Loading customers...
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <label className="text-sm font-black">
                    Test Customer
                  </label>

                  <select
                    value={selectedCustomerId}
                    onChange={(event) =>
                      setSelectedCustomerId(event.target.value)
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#678739] disabled:opacity-60"
                  >
                    <option value="">
                      Choose a customer
                    </option>

                    {customers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.first_name} {customer.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-black">
                    Card Information
                  </p>

                  <div
                    id="square-card-container"
                    className="mt-3 min-h-[90px] rounded-2xl border border-[#0A1821]/10 p-4"
                  />
                </div>

                <label className="mt-6 flex items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(event) =>
                      setConsentGiven(event.target.checked)
                    }
                    disabled={busy}
                    className="mt-1 h-4 w-4 accent-[#678739]"
                  />

                  <span>
                    I confirm the customer has given permission for
                    Dooty Done to securely save this card on file for
                    future services.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleSaveTestCard}
                  disabled={!cardReady || busy}
                  className="mt-6 w-full rounded-full bg-[#678739] px-5 py-4 text-sm font-black text-white shadow-md transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? "Saving Card..."
                    : cardReady
                      ? "Save Test Card"
                      : "Loading Card Form..."}
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
    </>
  )
}