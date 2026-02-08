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
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Daily Performance
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Date
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Messages
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Conversations
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Appointments
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Forms
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Estimates
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Missed Calls
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedData.map((day, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="w-16 bg-blue-100 rounded px-2 py-1 text-center">
                      {day.messagesSent || 0}
                    </span>
                    <div className="w-20 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${((day.messagesSent || 0) / maxMessages) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {day.conversationsStarted || 0}
                </td>
                <td className="px-4 py-3 text-right text-green-600 font-semibold">
                  {day.appointmentsReminded || 0}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {day.formsResponded || 0}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {day.estimatesFollowedUp || 0}
                </td>
                <td className="px-4 py-3 text-right text-red-600 font-semibold">
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
