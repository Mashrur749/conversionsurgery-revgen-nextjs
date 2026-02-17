import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function VerifyPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Check Your Email</CardTitle>
        <p className="text-muted-foreground">
          We sent you a login link to the email address you provided.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
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
