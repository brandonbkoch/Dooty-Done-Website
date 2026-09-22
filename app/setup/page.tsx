"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { payments } from "@square/web-sdk"
import { supabase } from "../../lib/supabase"

const SQUARE_APPLICATION_ID = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID || ""
const SQUARE_LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || ""

type SetupContext = {
  setup_token_id: number
  customer_id: number
  quote_id: number | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string
  zip_code: string | null
  number_of_dogs: number | null
  service_frequency: string | null
  quoted_price: number | null
  quote_status: string | null
  free_initial_cleanup_used: boolean
}

type SquareCard = {
  attach: (selector: string) => Promise<void>
  tokenize: (verificationDetails: {
    billingContact: {
      givenName: string
      familyName: string
      email?: string
      phone?: string
      addressLines: string[]
      countryCode: string
      postalCode?: string
    }
    intent: "STORE"
    customerInitiated: boolean
    sellerKeyedIn: boolean
  }) => Promise<{
    status: string
    token?: string
    errors?: unknown
  }>
  destroy?: () => Promise<void> | void
}

export default function CustomerSetupPage() {
  const cardContainerRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<SquareCard | null>(null)

  const [token, setToken] = useState("")
  const [setup, setSetup] = useState<SetupContext | null>(null)
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [loadingCard, setLoadingCard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [consentGiven, setConsentGiven] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const setupToken = params.get("token")?.trim() || ""
    setToken(setupToken)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSetup = async () => {
      if (!token) {
        setErrorMessage(
          "This setup link is missing its security token. Please use the link from Dooty Done."
        )
        setLoadingSetup(false)
        return
      }

      setErrorMessage("")

      try {
        const { data: setupRows, error: setupError } = await supabase.rpc(
          "get_customer_setup_context",
          { p_token: token }
        )

        if (setupError) {
          console.error("Customer setup lookup error:", setupError)
          throw new Error("We couldn't load this setup link.")
        }

        const setupRow = Array.isArray(setupRows) ? setupRows[0] : null

        if (!setupRow) {
          throw new Error(
            "This setup link is invalid, expired, already used, or no longer available."
          )
        }

        if (setupRow.quote_status !== "accepted") {
          throw new Error("This recurring service has not been approved yet.")
        }

        if (
          !["weekly", "biweekly", "twice-weekly"].includes(
            setupRow.service_frequency || ""
          )
        ) {
          throw new Error("This setup link is not for a recurring service.")
        }

        if (!cancelled) {
          setSetup(setupRow as SetupContext)
          setErrorMessage("")
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We couldn't load your setup information."
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingSetup(false)
        }
      }
    }

    loadSetup()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    let cancelled = false

    const setupSquareCard = async () => {
      if (!setup || !cardContainerRef.current || cardRef.current) return

      if (!SQUARE_APPLICATION_ID || !SQUARE_LOCATION_ID) {
        setErrorMessage("The secure payment form is not configured correctly.")
        return
      }

      setLoadingCard(true)

      try {
        const squarePayments = await payments(
          SQUARE_APPLICATION_ID,
          SQUARE_LOCATION_ID
        )

        if (!squarePayments) {
          throw new Error("Square could not load the secure payment form.")
        }

        const card = await squarePayments.card()

        if (cancelled) {
          await card.destroy?.()
          return
        }

        await card.attach("#square-card-container")
        cardRef.current = card as unknown as SquareCard
      } catch (error) {
        if (!cancelled) {
          console.error("Square card setup error:", error)
          setErrorMessage(
            "We couldn't load the secure card form. Please refresh the page and try again."
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingCard(false)
        }
      }
    }

    setupSquareCard()

    return () => {
      cancelled = true
      void cardRef.current?.destroy?.()
      cardRef.current = null
    }
  }, [setup])

  const handleSaveCard = async () => {
    setErrorMessage("")

    if (!setup || !token) {
      setErrorMessage("Your setup link is not valid.")
      return
    }

    if (!consentGiven) {
      setErrorMessage(
        "Please confirm that you authorize Dooty Done to keep this card on file for future completed recurring services."
      )
      return
    }

    if (!cardRef.current) {
      setErrorMessage(
        "The secure card form is still loading. Please wait a moment and try again."
      )
      return
    }

    setSaving(true)

    try {
      const tokenResult = await cardRef.current.tokenize({
        billingContact: {
          givenName: setup.first_name,
          familyName: setup.last_name,
          email: setup.email || undefined,
          phone: setup.phone || undefined,
          addressLines: [setup.address],
          countryCode: "US",
          postalCode: setup.zip_code || undefined,
        },
        intent: "STORE",
        customerInitiated: true,
        sellerKeyedIn: false,
      })

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        console.error("Square tokenization errors:", tokenResult.errors)
        throw new Error(
          "We couldn't verify that card. Please check the card information and try again."
        )
      }

      const response = await fetch("/api/setup-save-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          sourceId: tokenResult.token,
          consentGiven: true,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.error || "We couldn't save your payment method."
        )
      }

      setSuccess(true)
      setConsentGiven(true)
    } catch (error) {
      console.error("Save card error:", error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't save your payment method."
      )
    } finally {
      setSaving(false)
    }
  }

  const formatFrequency = (frequency: string | null) => {
    switch (frequency) {
      case "weekly":
        return "Weekly"
      case "twice-weekly":
        return "Twice Weekly"
      case "biweekly":
        return "Every Other Week"
      default:
        return "Recurring Service"
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#FEFBF7] px-5 py-10 text-[#0A1821] sm:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-[#678739]/20 bg-white p-8 text-center shadow-xl sm:p-12">
            <Image
              src="/dooty-done-logo.png"
              alt="Dooty Done"
              width={220}
              height={100}
              className="mx-auto h-auto w-44 object-contain sm:w-52"
            />

            <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F5EA] text-3xl">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-black sm:text-4xl">
              You’re all set!
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#0A1821]/65">
              Your payment card is securely saved with Square. You will only be
              charged after completed recurring visits, according to the agreed
              service price.
            </p>

            <p className="mt-6 text-sm font-bold text-[#678739]">
              Simple. Clean. Done.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FEFBF7] px-5 py-10 text-[#0A1821] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <Image
            src="/dooty-done-logo.png"
            alt="Dooty Done"
            width={220}
            height={100}
            className="mx-auto h-auto w-44 object-contain sm:w-52"
          />
        </div>

        <section className="rounded-3xl border border-[#0A1821]/10 bg-white p-6 shadow-xl sm:p-10">
          <p className="text-center font-extrabold uppercase tracking-[0.16em] text-[#678739]">
            Customer Setup
          </p>

          <h1 className="mt-3 text-center text-3xl font-black sm:text-4xl">
            Secure Your Service
          </h1>

          {loadingSetup ? (
            <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5 text-center text-sm font-bold text-[#536f2e]">
              Loading your setup information...
            </div>
          ) : errorMessage && !setup ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
              {errorMessage}
            </div>
          ) : setup ? (
            <>
              <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5">
                <p className="text-lg font-black">
                  Hi {setup.first_name}!
                </p>

                <p className="mt-2 text-sm leading-6 text-[#0A1821]/65">
                  Your Dooty Done recurring service is ready for the next step.
                  Please review the details below and securely save your card on
                  file.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-[#0A1821]/45">
                      Service
                    </p>
                    <p className="mt-1 font-black">
                      {formatFrequency(setup.service_frequency)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-[#0A1821]/45">
                      Agreed Price
                    </p>
                    <p className="mt-1 font-black text-[#678739]">
                      {setup.quoted_price !== null
                        ? `$${Number(setup.quoted_price).toFixed(2)} / visit`
                        : "Custom quote"}
                    </p>
                  </div>
                </div>

                {setup.free_initial_cleanup_used === false && (
                  <div className="mt-5 rounded-2xl bg-white p-4">
                    <p className="font-black text-[#536f2e]">
                      🎉 Your first recurring cleanup is FREE.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-8">
                <h2 className="text-xl font-black">Save your card</h2>
                <p className="mt-2 text-sm leading-6 text-[#0A1821]/60">
                  Your card information is entered directly into Square’s secure
                  payment form. Dooty Done does not store your full card number.
                </p>

                <div
                  id="square-card-container"
                  ref={cardContainerRef}
                  className="mt-5 min-h-24 rounded-2xl border border-[#0A1821]/10 bg-white p-2"
                />

                {loadingCard && (
                  <p className="mt-3 text-sm font-semibold text-[#0A1821]/50">
                    Loading secure payment form...
                  </p>
                )}
              </div>

              <label className="mt-6 flex items-start gap-3 rounded-2xl border border-[#0A1821]/10 bg-[#FEFBF7] p-4">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(event) => setConsentGiven(event.target.checked)}
                  disabled={saving}
                  className="mt-1 h-5 w-5 accent-[#678739]"
                />
                <span className="text-sm leading-6 text-[#0A1821]/70">
                  I authorize Dooty Done to securely keep this card on file and
                  charge it for completed recurring services at the agreed
                  price. I understand future charges are made after service is
                  completed.
                </span>
              </label>

              {errorMessage && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveCard}
                disabled={saving || loadingSetup || loadingCard || !cardRef.current}
                className="mt-6 w-full rounded-full bg-[#678739] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving securely..." : "Save Card Securely →"}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-[#0A1821]/45">
                Securely processed by Square. Dooty Done never sees or stores
                your full card number.
              </p>
            </>
          ) : (
            <div className="mt-8 rounded-2xl bg-[#F1F5EA] p-5 text-center text-sm font-semibold text-[#0A1821]/60">
              We couldn't load your setup information.
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs font-semibold text-[#0A1821]/45">
          Dooty Done LLC • Colorado Springs, Colorado
        </p>
      </div>
    </main>
  )
}
