import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminBillingStats } from '@/lib/billing/queries';
import { AdminSubscriptionTable } from '@/components/admin/billing/AdminSubscriptionTable';
import { RevenueChart } from '@/components/admin/billing/RevenueChart';
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Billing Management | Admin',
};

async function AdminBillingContent() {
  const session = await auth();
  if (!session || !session?.user?.isAdmin) {
    redirect('/login');
  }

  const stats = await getAdminBillingStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Management</h1>
        <p className="text-muted-foreground">
          Monitor subscriptions, revenue, and payment issues.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.mrr / 100).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.mrrChange >= 0 ? '+' : ''}{stats.mrrChange}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.trialingSubscriptions} in trial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.canceledThisMonth} canceled this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.failedPayments}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(stats.failedPaymentsAmount / 100).toLocaleString()} at risk
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={stats.revenueHistory} />

      {/* Subscriptions Table */}
      <AdminSubscriptionTable />
    </div>
  );
}

export default function AdminBillingPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading billing data...</div>}>
      <AdminBillingContent />
    </Suspense>
  );
}
