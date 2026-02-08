import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="max-w-md mx-auto mt-20 text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{message}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
