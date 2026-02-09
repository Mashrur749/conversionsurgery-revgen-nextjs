import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <p className="text-sm text-muted-foreground">
          Text <strong>DASHBOARD</strong> to your business number to get a new link.
        </p>
      </CardContent>
    </Card>
  );
}
