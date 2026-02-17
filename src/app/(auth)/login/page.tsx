"use client";

import { useState, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Failed to send sign-in link");
      }

      setSubmittedEmail(email);
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
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ConversionSurgery</CardTitle>
        <p className="text-muted-foreground">
          Enter your email to receive a login link
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorParam && (
          <div className="bg-[#FDEAE4] border border-destructive/30 rounded-md p-3">
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
              />
            </div>

            {error && (
              <div className="bg-[#FDEAE4] border border-destructive/30 rounded-md p-3">
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
      <Card>
        <CardHeader className="text-center space-y-2">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    }>
      <LoginContent />
    </Suspense>
  );
}
