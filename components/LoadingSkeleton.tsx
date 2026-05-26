export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-700/50 ${className}`}
      aria-hidden="true"
    />
  );
}

export function PoliticianDetailSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingSkeleton className="h-5 w-32" />

      {/* hero */}
      <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-6 space-y-3">
        <LoadingSkeleton className="h-3 w-40" />
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-4 w-48" />
        <LoadingSkeleton className="h-16 w-28 mt-4" />
      </div>

      {/* grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LoadingSkeleton className="h-72" />
        <div className="space-y-4">
          <LoadingSkeleton className="h-32" />
          <LoadingSkeleton className="h-24" />
          <LoadingSkeleton className="h-24" />
        </div>
      </div>

      <LoadingSkeleton className="h-40" />
    </div>
  );
}
