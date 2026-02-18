import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Props {
  searchParams: Promise<{ reason?: string; by?: string }>;
}

export default async function ClaimErrorPage({ searchParams }: Props) {
  const { reason, by } = await searchParams;

  let title = 'Claim Error';
  let message = 'Something went wrong with this claim link.';

  if (reason === 'invalid') {
    title = 'Invalid Link';
    message = 'This claim link is invalid or has expired.';
  } else if (reason === 'claimed') {
    title = 'Already Claimed';
    message = `${by || 'Someone'} is already handling this lead.`;
  }

  return (
    <Card className="max-w-md mx-auto overflow-hidden border-0 shadow-2xl text-center">
      <div className="bg-forest px-6 py-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-3">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
      </div>
      <CardContent className="p-6 space-y-4">
        <p className="text-muted-foreground">{message}</p>
        <Button asChild variant="outline">
          <Link href="/login">Back to Login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
