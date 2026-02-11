export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="size-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  );
}
