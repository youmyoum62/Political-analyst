import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <p className="animate-pulse py-3 text-center text-sm text-muted">
        APIを起動中です。初回アクセス時は30〜40秒かかる場合があります...
      </p>
      {Array.from({ length: 6 }).map((_, i) => (
        <LoadingSkeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
