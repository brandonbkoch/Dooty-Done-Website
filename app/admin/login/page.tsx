"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

export default function AdminLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setLoading(true)
    setErrorMessage("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Admin login error:", error)
      setErrorMessage("Invalid email or password.")
      setLoading(false)
      return
    }

    router.push("/admin")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FEFBF7] px-5 py-12 text-[#0A1821]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/dooty-done-logo.png"
            alt="Dooty Done Pet Waste Removal"
            className="mx-auto h-24 w-auto object-contain"
          />

          <h1 className="mt-6 text-3xl font-black">
            Dooty Done Admin
          </h1>

          <p className="mt-2 text-sm text-[#0A1821]/60">
            Sign in to manage your business.
          </p>
        </div>

        <div className="rounded-[2rem] border border-[#0A1821]/10 bg-white p-6 shadow-xl sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-extrabold"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="Business email"
                className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-extrabold"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="Your password"
                className="w-full rounded-2xl border border-[#0A1821]/15 bg-white px-4 py-3.5 outline-none transition focus:border-[#678739] focus:ring-2 focus:ring-[#678739]/15"
              />
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#678739] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#536f2e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-[#0A1821]/45">
            Dooty Done business management portal.
          </p>
        </div>
      </div>
    </main>
  )
}