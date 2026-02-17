import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-[#3D7A50]" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Thank you for your payment. You should receive a confirmation text
            shortly.
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this window now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
