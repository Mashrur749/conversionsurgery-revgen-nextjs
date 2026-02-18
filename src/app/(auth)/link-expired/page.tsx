import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LinkExpiredPage() {
  return (
    <Card className="max-w-md mx-auto overflow-hidden border-0 shadow-2xl text-center">
      <div className="bg-forest px-6 py-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-3">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Link Expired</h1>
      </div>
      <CardContent className="p-6 space-y-4">
        <p className="text-muted-foreground">
          This dashboard link has expired or is invalid.
        </p>
        <Button asChild className="w-full">
          <Link href="/client-login">Log In to Your Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
