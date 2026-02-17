'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { AddPaymentMethodDialog } from './AddPaymentMethodDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PaymentMethod {
  id: string;
  type: string;
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
  };
}

interface PaymentMethodCardProps {
  paymentMethods: PaymentMethod[];
  onAddPaymentMethod: (paymentMethodId: string) => Promise<void>;
  onRemovePaymentMethod: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  hasFailedPayment?: boolean;
}

export function PaymentMethodCard({
  paymentMethods,
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onSetDefault,
  hasFailedPayment,
}: PaymentMethodCardProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleteId) {
      await onRemovePaymentMethod(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Method
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasFailedPayment && (
            <div className="rounded-lg bg-[#FDEAE4] p-3 text-sm text-sienna">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Your last payment failed. Please update your payment method.
            </div>
          )}

          {paymentMethods.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No payment methods added yet.
            </p>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {method.type === 'card' ? '💳' : '🏦'}
                    </div>
                    <div>
                      {method.type === 'card' && method.card ? (
                        <>
                          <p className="font-medium capitalize">
                            {method.card.brand} &bull;&bull;&bull;&bull; {method.card.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires {method.card.expMonth}/{method.card.expYear}
                          </p>
                        </>
                      ) : method.bankAccount ? (
                        <>
                          <p className="font-medium">
                            {method.bankAccount.bankName} &bull;&bull;&bull;&bull; {method.bankAccount.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Bank Account
                          </p>
                        </>
                      ) : null}
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSetDefault(method.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    {!method.isDefault && paymentMethods.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteId(method.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddPaymentMethodDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={onAddPaymentMethod}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
