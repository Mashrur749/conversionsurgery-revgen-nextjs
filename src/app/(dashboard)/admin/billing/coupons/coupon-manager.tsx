'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Ticket, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Coupon } from '@/db/schema/coupons';

interface CouponManagerProps {
  coupons: Coupon[];
}

export function CouponManager({ coupons: initialCoupons }: CouponManagerProps) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    const body = {
      code: form.get('code') as string,
      name: form.get('name') as string || undefined,
      discountType: form.get('discountType') as 'percent' | 'amount',
      discountValue: Number(form.get('discountValue')),
      duration: (form.get('duration') || 'once') as 'once' | 'repeating' | 'forever',
      durationMonths: form.get('durationMonths') ? Number(form.get('durationMonths')) : undefined,
      maxRedemptions: form.get('maxRedemptions') ? Number(form.get('maxRedemptions')) : undefined,
      validUntil: form.get('validUntil') ? new Date(form.get('validUntil') as string).toISOString() : undefined,
      firstTimeOnly: form.get('firstTimeOnly') === 'on',
    };

    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setCreateOpen(false);
      router.refresh();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
    }
  };

  const deleteCoupon = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/coupons/${deleteId}`, { method: 'DELETE' });
    if (res.ok) {
      setCoupons(prev => prev.filter(c => c.id !== deleteId));
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 cursor-pointer">
            <Ticket className="h-4 w-4 mr-2" /> Create Coupon
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Coupon</DialogTitle>
            </DialogHeader>
            <form onSubmit={createCoupon} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" name="code" required placeholder="SAVE20" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input id="name" name="name" placeholder="Summer Sale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountType">Type</Label>
                  <select name="discountType" defaultValue="percent"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="percent">Percentage (%)</option>
                    <option value="amount">Fixed Amount (cents)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountValue">Value</Label>
                  <Input id="discountValue" name="discountValue" type="number" required placeholder="20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <select name="duration" defaultValue="once"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="once">Once</option>
                    <option value="repeating">Repeating</option>
                    <option value="forever">Forever</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationMonths">Months (if repeating)</Label>
                  <Input id="durationMonths" name="durationMonths" type="number" placeholder="3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxRedemptions">Max Uses</Label>
                  <Input id="maxRedemptions" name="maxRedemptions" type="number" placeholder="Unlimited" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validUntil">Expires</Label>
                  <Input id="validUntil" name="validUntil" type="date" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox id="firstTimeOnly" name="firstTimeOnly" />
                <Label htmlFor="firstTimeOnly" className="font-normal">First-time subscribers only</Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Coupon'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No coupons yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map(coupon => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                    <TableCell>
                      {coupon.discountType === 'percent'
                        ? `${coupon.discountValue}%`
                        : `$${(coupon.discountValue / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>{coupon.duration}{coupon.durationMonths ? ` (${coupon.durationMonths}mo)` : ''}</TableCell>
                    <TableCell>
                      {coupon.timesRedeemed ?? 0}
                      {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge className={coupon.isActive ? 'bg-[#E8F5E9] text-[#3D7A50]' : 'bg-muted text-foreground'}>
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {coupon.validUntil && new Date(coupon.validUntil) < new Date() && (
                        <Badge variant="outline" className="ml-1">Expired</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(coupon.createdAt, 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(coupon.id, !coupon.isActive)}
                        >
                          {coupon.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteId(coupon.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this coupon. It will no longer be usable by clients.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteCoupon}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
