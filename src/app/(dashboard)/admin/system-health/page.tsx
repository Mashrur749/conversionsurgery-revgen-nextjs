import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { generateMonthlyDigest } from '@/lib/services/monthly-health-digest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/breadcrumbs';

export const dynamic = 'force-dynamic';

function StatusBadge({ status, backlog }: { status: string; backlog: number }) {
  if (status === 'failed') {
    return (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded"
        style={{ backgroundColor: '#FDEAE4', color: '#C15B2E' }}
      >
        Failed
      </span>
    );
  }
  if (backlog > 0) {
    return (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded"
        style={{ backgroundColor: '#FFF3E0', color: '#C15B2E' }}
      >
        Backlogged ({backlog})
      </span>
    );
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded"
      style={{ backgroundColor: '#E8F5E9', color: '#3D7A50' }}
    >
      Healthy
    </span>
  );
}

function UtilizationBar({ percent, alertLevel }: { percent: number; alertLevel: string }) {
  let barColor = '#3D7A50';
  if (alertLevel === 'yellow') barColor = '#D4754A';
  if (alertLevel === 'red') barColor = '#C15B2E';

  const clamped = Math.min(percent, 100);

  return (
    <div className="mt-3">
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: '#6B7E54' }}>Utilization</span>
        <span className="font-semibold" style={{ color: '#1B2F26' }}>
          {percent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#E3E9E1] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export default async function SystemHealthPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const digest = await generateMonthlyDigest();
  const { clientOverview, capacity, automationHealth, guaranteeTracker, keyMetrics } =
    digest.sections;

  const generatedDate = new Date(digest.generatedAt).toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'System Health' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F26' }}>
          System Health
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monthly operational digest &mdash; generated {generatedDate}
        </p>
      </div>

      {/* Row 1: Client Overview + Capacity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Client Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: '#1B2F26' }}>
              Client Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Active</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: '#3D7A50' }}>
                  {clientOverview.active}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paused</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: '#D4754A' }}>
                  {clientOverview.paused}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cancelled</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: '#C15B2E' }}>
                  {clientOverview.cancelled}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">New this month</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: '#1B2F26' }}>
                  +{clientOverview.newThisMonth}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Churned this month</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: clientOverview.churnedThisMonth > 0 ? '#C15B2E' : '#1B2F26' }}>
                  {clientOverview.churnedThisMonth}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: '#1B2F26' }}>
              Operator Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Weekly hours</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: '#1B2F26' }}>
                  {capacity.totalWeeklyHours.toFixed(1)}h
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Max capacity</dt>
                <dd className="text-xl font-bold mt-0.5" style={{ color: '#1B2F26' }}>
                  {capacity.maxHours}h
                </dd>
              </div>
            </dl>
            <UtilizationBar percent={capacity.utilizationPercent} alertLevel={capacity.alertLevel} />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Key Metrics + Guarantee Tracker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Key Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: '#1B2F26' }}>
              Key Metrics This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-4 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Messages sent</dt>
                <dd className="font-semibold text-base" style={{ color: '#1B2F26' }}>
                  {keyMetrics.messagesSentThisMonth.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Leads created</dt>
                <dd className="font-semibold text-base" style={{ color: '#1B2F26' }}>
                  {keyMetrics.leadsCreatedThisMonth.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Won revenue</dt>
                <dd className="font-semibold text-base" style={{ color: '#3D7A50' }}>
                  {formatCurrency(keyMetrics.totalWonRevenueCents)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Guarantee Tracker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: '#1B2F26' }}>
              Guarantee Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-4 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Active guarantees</dt>
                <dd className="font-semibold text-base" style={{ color: '#1B2F26' }}>
                  {guaranteeTracker.activeGuarantees}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Approaching deadline (&lt;30 days)</dt>
                <dd
                  className="font-semibold text-base"
                  style={{
                    color: guaranteeTracker.approaching30Days > 0 ? '#C15B2E' : '#1B2F26',
                  }}
                >
                  {guaranteeTracker.approaching30Days}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Fulfilled</dt>
                <dd className="font-semibold text-base" style={{ color: '#3D7A50' }}>
                  {guaranteeTracker.fulfilled}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Automation Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold" style={{ color: '#1B2F26' }}>
            Automation Health
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {automationHealth.totalJobs} scheduled jobs &mdash;{' '}
            <span style={{ color: '#3D7A50' }}>{automationHealth.healthy} healthy</span>
            {automationHealth.failed > 0 && (
              <>
                ,{' '}
                <span style={{ color: '#C15B2E' }}>{automationHealth.failed} failed</span>
              </>
            )}
            {automationHealth.backlogged > 0 && (
              <>
                ,{' '}
                <span style={{ color: '#D4754A' }}>{automationHealth.backlogged} backlogged</span>
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {automationHealth.jobs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No cron jobs recorded yet.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#F8F9FA]">
                      <th className="text-left px-6 py-3 font-medium text-muted-foreground">Job</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Run</th>
                      <th className="text-right px-6 py-3 font-medium text-muted-foreground">Backlog</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automationHealth.jobs.map((job, i) => (
                      <tr key={job.key} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FA]'}>
                        <td className="px-6 py-3 font-mono text-xs" style={{ color: '#1B2F26' }}>
                          {job.key}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={job.status} backlog={job.backlog} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {job.lastRunAt
                            ? new Date(job.lastRunAt).toLocaleString('en-CA', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Never'}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {job.backlog}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden divide-y">
                {automationHealth.jobs.map((job) => (
                  <div key={job.key} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs break-all" style={{ color: '#1B2F26' }}>
                        {job.key}
                      </span>
                      <StatusBadge status={job.status} backlog={job.backlog} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last run:{' '}
                      {job.lastRunAt
                        ? new Date(job.lastRunAt).toLocaleString('en-CA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : 'Never'}
                      {job.backlog > 0 && ` · Backlog: ${job.backlog}`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground pb-4">
        Data is computed on page load. Refresh to get the latest snapshot.
      </p>
    </div>
  );
}
