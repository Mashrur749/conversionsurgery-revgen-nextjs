import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function VerifyPage() {
  return (
    <Card className="overflow-hidden border-0 shadow-2xl">
      <div className="bg-forest px-6 py-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-3">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Check Your Email</h1>
        <p className="text-sm text-white/60 mt-1">
          We sent you a login link to the email address you provided.
        </p>
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="bg-sage-light border border-forest-light/30 rounded-lg p-4">
          <p className="text-sm text-forest">
            Click the link in your email to sign in. The link will expire in 24 hours.
          </p>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">Didn&apos;t receive the email?</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Check your spam folder</li>
            <li>Try signing in again with your email</li>
          </ul>
        </div>

        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to Login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
