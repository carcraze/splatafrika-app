export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0A1628]">
      <div className="text-center space-y-6 px-6">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
          Splat<span className="text-[#00D4AA]">Afrika</span>
        </h1>
        <p className="text-lg text-[#8FA3B1] max-w-md mx-auto">
          Hyperreal 3D property tours. Captured on smartphone, delivered as a
          shareable browser link.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <a
            href="/dashboard"
            className="px-8 py-4 bg-[#00D4AA] hover:bg-[#33DDBB] active:bg-[#00BF97] text-[#003D30] font-semibold text-base rounded-2xl transition-all duration-200 ease-out hover:shadow-[0_8px_24px_rgba(0,212,170,0.35)] active:scale-[0.98]"
          >
            Open Dashboard
          </a>
          <a
            href="/capture"
            className="px-6 py-3 border border-[#E2E8ED]/20 hover:border-[#00D4AA] text-[#8FA3B1] hover:text-[#00D4AA] rounded-xl font-medium text-sm transition-all duration-200 bg-white/5 hover:bg-white/10"
          >
            Start Capture
          </a>
        </div>
      </div>
    </main>
  );
}
