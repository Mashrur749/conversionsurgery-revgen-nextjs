interface DailyStats {
  date: string;
  messagesSent?: number;
  conversationsStarted?: number;
  appointmentsReminded?: number;
  formsResponded?: number;
  estimatesFollowedUp?: number;
  missedCallsCaptured?: number;
}

interface Props {
  data: DailyStats[];
}

export default function ReportPerformanceChart({ data }: Props) {
  if (!data || data.length === 0) {
    return null;
  }

  // Sort data by date
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate max values for scaling
  const maxMessages = Math.max(
    ...sortedData.map((d) => d.messagesSent || 0),
    1
  );

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-xl font-bold text-foreground mb-6">
        Daily Performance
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Messages
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Conversations
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Appointments
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Forms
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Estimates
              </th>
              <th className="px-4 py-3 text-right font-medium text-foreground">
                Missed Calls
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedData.map((day, idx) => (
              <tr key={idx} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-3 text-foreground font-medium">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="w-16 bg-sage-light rounded px-2 py-1 text-center">
                      {day.messagesSent || 0}
                    </span>
                    <div className="w-20 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-forest transition-all"
                        style={{
                          width: `${((day.messagesSent || 0) / maxMessages) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {day.conversationsStarted || 0}
                </td>
                <td className="px-4 py-3 text-right text-[#3D7A50] font-semibold">
                  {day.appointmentsReminded || 0}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {day.formsResponded || 0}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {day.estimatesFollowedUp || 0}
                </td>
                <td className="px-4 py-3 text-right text-destructive font-semibold">
                  {day.missedCallsCaptured || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
