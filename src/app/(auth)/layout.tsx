export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1B2F26] relative overflow-hidden">
      {/* Subtle radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#2a4a3a_0%,_#1B2F26_70%)]" />
      <div className="w-full max-w-md px-4 relative z-10">
        {children}
      </div>
    </div>
  );
}
