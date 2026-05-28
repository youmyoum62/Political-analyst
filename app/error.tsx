'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6">
      <h1 className="text-2xl font-black text-rose-100">データを取得できませんでした</h1>
      <p className="mt-3 text-sm text-rose-100/90">
        バックエンド API への接続またはレスポンス形式を確認してください。代替データは表示していません。
      </p>
      <p className="mt-3 rounded-xl border border-rose-400/30 bg-slate-950/50 p-3 text-xs text-rose-100">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full bg-rose-100 px-4 py-2 text-sm font-black text-rose-950"
      >
        再試行
      </button>
    </section>
  );
}
