import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminBillingStats } from '@/lib/billing/queries';
import { AdminSubscriptionTable } from '@/components/admin/billing/AdminSubscriptionTable';
import { RevenueChart } from '@/components/admin/billing/RevenueChart';
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { listPendingDataExportRequests } from '@/lib/services/data-export-requests';

function formatDate(value: Date | null): string {
  if (!value) {
    return 'n/a';
  }
  return value.toLocaleDateString();
}

function getSlaBadgeClasses(state: 'on_track' | 'at_risk' | 'breached' | 'closed'): string {
  switch (state) {
    case 'breached':
      return 'bg-[#FDEAE4] text-sienna';
    case 'at_risk':
      return 'bg-[#FFF3E0] text-sienna';
    case 'closed':
      return 'bg-muted text-foreground';
    default:
      return 'bg-[#E8F5E9] text-[#3D7A50]';
  }
}

export const metadata = {
  title: 'Billing Management | Admin',
};

async function AdminBillingContent() {
  const session = await auth();
  if (!session || !session?.user?.isAgency) {
    redirect('/login');
  }

  const [stats, exportQueue] = await Promise.all([
    getAdminBillingStats(),
    listPendingDataExportRequests(25),
  ]);

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

      {/* Data Export SLA Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Data Export SLA Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending export requests.</p>
          ) : (
            <div className="space-y-2">
              {exportQueue.map((request) => (
                <div key={request.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{request.businessName}</p>
                    <span className={`rounded px-2 py-1 text-xs font-medium ${getSlaBadgeClasses(request.slaState)}`}>
                      {request.slaState.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Status: {request.status} | Requested: {formatDate(request.requestedAt)} | Due: {formatDate(request.dueAt)}
                  </p>
                  {request.failureReason ? (
                    <p className="text-xs text-sienna mt-1">Failure: {request.failureReason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
