"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const errorParam = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    invalid_token: "Invalid or expired sign-in link",
    token_expired: "Sign-in link has expired. Please request a new one.",
    missing_params: "Invalid sign-in link",
    server_error: "Something went wrong. Please try again.",
  };

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send sign-in link");
      }

      setSubmitted(true);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Revenue Recovery</h1>
        <p className="text-slate-600">
          Enter your email to receive a login link
        </p>
      </div>

      {errorParam && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-800 text-sm">
            {errorMessages[errorParam] ||
              "An error occurred. Please try again."}
          </p>
        </div>
      )}

      {submitted ? (
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-800 font-medium">Check your email!</p>
            <p className="text-green-700 text-sm mt-2">
              We&apos;ve sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>
          <p className="text-slate-600 text-sm">
            Click the link in your email to sign in. The link expires in 24
            hours.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Try another email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? "Sending..." : "Send Login Link"}
          </button>

          <p className="text-xs text-center text-slate-500">
            We&apos;ll send you a magic link to sign in securely.
          </p>
        </form>
      )}
    </div>
  );
}
