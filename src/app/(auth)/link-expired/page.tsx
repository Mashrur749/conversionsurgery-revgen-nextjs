import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LinkExpiredPage() {
  return (
    <Card className="max-w-md mx-auto text-center">
      <CardHeader>
        <CardTitle>Link Expired</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
