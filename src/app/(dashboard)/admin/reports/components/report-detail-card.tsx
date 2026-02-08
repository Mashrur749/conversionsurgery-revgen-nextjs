interface Props {
  title: string;
  children: React.ReactNode;
}

export default function ReportDetailCard({ title, children }: Props) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  );
}
