interface Props {
  roiSummary: any;
  metrics: any;
}

export default function ReportMetricsGrid({ roiSummary, metrics }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Conversion Rate */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-muted-foreground text-sm font-medium">Conversion Rate</p>
        <p className="text-4xl font-bold mt-3 text-[#3D7A50]">
          {roiSummary.conversionRate?.toFixed(1) || '0'}%
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {roiSummary.appointmentsReminded || 0} appointments from{' '}
          {roiSummary.messagesSent || 0} messages
        </p>
      </div>

      {/* Engagement Rate */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-muted-foreground text-sm font-medium">Engagement Rate</p>
        <p className="text-4xl font-bold mt-3 text-forest">
          {roiSummary.engagementRate?.toFixed(1) || '0'}%
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Conversations started per message
        </p>
      </div>

      {/* Messages Sent */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-muted-foreground text-sm font-medium">Messages Sent</p>
        <p className="text-4xl font-bold mt-3">
          {roiSummary.messagesSent || 0}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Avg {roiSummary.averagePerDay || '0'} per day
        </p>
      </div>

      {/* Appointments Reminded */}
      <div className="bg-white rounded-lg border p-6">
        <p className="text-muted-foreground text-sm font-medium">Appointments</p>
        <p className="text-4xl font-bold mt-3 text-olive">
          {roiSummary.appointmentsReminded || 0}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Over {roiSummary.daysInPeriod || 0} days
        </p>
      </div>
    </div>
  );
}
