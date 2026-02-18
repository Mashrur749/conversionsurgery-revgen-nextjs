"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const errorParam = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    invalid_token: "Invalid or expired sign-in link",
    token_expired: "Sign-in link has expired. Please request a new one.",
    missing_params: "Invalid sign-in link",
    server_error: "Something went wrong. Please try again.",
    AccessDenied: "No account found for this email address.",
  };

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      // Always show "check your email" regardless of result
      // to prevent email enumeration attacks
      setSubmittedEmail(email);
      setSubmitted(true);
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-0 shadow-2xl">
      <div className="bg-forest px-6 py-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-3">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white">ConversionSurgery</h1>
        <p className="text-sm text-white/60 mt-1">
          Enter your email to receive a login link
        </p>
      </div>
      <CardContent className="p-6 space-y-4">
        {errorParam && (
          <div role="alert" className="bg-[#FDEAE4] border border-destructive/30 rounded-md p-3">
            <p className="text-sienna text-sm">
              {errorMessages[errorParam] ||
                "An error occurred. Please try again."}
            </p>
          </div>
        )}

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="bg-[#E8F5E9] border border-[#3D7A50]/30 rounded-md p-4">
              <p className="text-[#3D7A50] font-medium">Check your email!</p>
              <p className="text-[#3D7A50] text-sm mt-2">
                We&apos;ve sent a sign-in link to <strong>{submittedEmail}</strong>
              </p>
            </div>
            <p className="text-muted-foreground text-sm">
              Click the link in your email to sign in. The link expires in 24
              hours.
            </p>
            <Button
              variant="link"
              onClick={() => setSubmitted(false)}
            >
              Try another email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                aria-invalid={!!error || undefined}
              />
            </div>

            {error && (
              <div role="alert" className="bg-[#FDEAE4] border border-destructive/30 rounded-md p-3">
                <p className="text-sienna text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full"
            >
              {isLoading ? "Sending..." : "Send Login Link"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              We&apos;ll send you a magic link to sign in securely.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card className="overflow-hidden border-0 shadow-2xl">
        <div className="bg-forest px-6 py-6 text-center">
          <Skeleton className="h-12 w-12 rounded-xl mx-auto mb-3 bg-white/10" />
          <Skeleton className="h-6 w-48 mx-auto bg-white/10" />
          <Skeleton className="h-4 w-64 mx-auto mt-2 bg-white/10" />
        </div>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    }>
      <LoginContent />
    </Suspense>
  );
}
