export default function WorldCupDocsLoading() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white sm:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
        <div className="mt-5 h-12 w-80 max-w-full animate-pulse rounded bg-white/10" />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[2/3] animate-pulse rounded-xl border border-white/10 bg-white/10"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
