'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type Method = 'phone' | 'email';
type Phase = 'identifier' | 'otp';

const RESEND_COOLDOWN = 30;

export default function ClientLoginPage() {
  const router = useRouter();

  const [method, setMethod] = useState<Method>('phone');
  const [phase, setPhase] = useState<Phase>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Load remembered method from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cs_login_method');
      if (saved === 'email') setMethod('email');
    } catch {
      // localStorage not available
    }
  }, []);

  // Focus code input when entering OTP phase
  useEffect(() => {
    if (phase === 'otp') {
      codeInputRef.current?.focus();
    }
  }, [phase]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const switchMethod = useCallback((newMethod: Method) => {
    setMethod(newMethod);
    setIdentifier('');
    setError('');
    try {
      localStorage.setItem('cs_login_method', newMethod);
    } catch {
      // localStorage not available
    }
  }, []);

  async function handleSendOTP(e?: React.FormEvent) {
    e?.preventDefault();
    if (!identifier.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/client/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), method }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; retryAfterSeconds?: number };

      if (res.status === 429) {
        setError(`Too many requests. Try again in ${data.retryAfterSeconds ?? 60} seconds.`);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to send code');
        setLoading(false);
        return;
      }

      setPhase('otp');
      setCode('');
      setResendCooldown(RESEND_COOLDOWN);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/client/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code, method }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; attemptsRemaining?: number };

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        if (data.attemptsRemaining === 0) {
          // Locked out — go back to send new code
          setPhase('identifier');
          setCode('');
        }
        setLoading(false);
        return;
      }

      router.push('/client');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  function handleResend() {
    if (resendCooldown > 0) return;
    setCode('');
    setError('');
    handleSendOTP();
  }

  const displayIdentifier =
    method === 'phone' ? formatPhoneDisplay(identifier) : identifier;

  return (
    <Card className="mx-auto max-w-md overflow-hidden border-0 shadow-2xl">
      <div className="bg-forest px-6 py-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-3">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white">ConversionSurgery</h1>
        <p className="text-sm text-white/60 mt-1">Sign in to your dashboard</p>
      </div>
      <CardContent className="p-6">
        {phase === 'identifier' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            {method === 'phone' ? (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="py-3 text-lg"
                  autoFocus
                  aria-invalid={!!error || undefined}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="py-3 text-lg"
                  autoFocus
                  aria-invalid={!!error || undefined}
                />
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full py-3"
              size="lg"
              disabled={loading || !identifier.trim()}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </Button>

            <p className="text-center">
              <button
                type="button"
                onClick={() => switchMethod(method === 'phone' ? 'email' : 'phone')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {method === 'phone' ? 'Use email instead \u2192' : 'Use phone instead \u2192'}
              </button>
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Enter the code sent to{' '}
              <span className="font-medium text-foreground">{displayIdentifier}</span>
            </p>

            <Input
              ref={codeInputRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setCode(val);
              }}
              className="py-3 text-center text-2xl tracking-[0.5em]"
            />

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            {loading && code.length === 6 && (
              <p className="text-center text-sm text-muted-foreground">Verifying...</p>
            )}

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                aria-label="Go back to enter phone or email"
                onClick={() => {
                  setPhase('identifier');
                  setCode('');
                  setError('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className={
                  resendCooldown > 0
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground transition-colors'
                }
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Simple phone display formatter — adds parens and dashes for US/CA numbers */
function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
