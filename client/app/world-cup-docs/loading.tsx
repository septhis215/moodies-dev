export default function WorldCupDocsLoading() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05130b] px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.18),transparent_24%),radial-gradient(circle_at_82%_0%,rgba(255,214,89,0.2),transparent_24%),linear-gradient(135deg,rgba(233,79,55,0.18),transparent_38%,rgba(16,185,129,0.16))]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40 p-5 shadow-2xl shadow-black/50 backdrop-blur sm:p-7">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 animate-pulse rounded-lg border border-white/15 bg-white/10" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-44 animate-pulse rounded bg-yellow-200/20" />
              <div className="mt-5 h-12 w-96 max-w-full animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-4 w-[32rem] max-w-full animate-pulse rounded bg-white/10" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-9 w-28 animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[2/3] animate-pulse rounded-xl border border-white/10 bg-black/35"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
