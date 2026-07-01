'use client';

import { useEffect, useState } from 'react';

const RETRY_SECONDS = 20;

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(RETRY_SECONDS);

  useEffect(() => {
    if (countdown <= 0) {
      reset();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, reset]);

  return (
    <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6">
      <h1 className="text-2xl font-black text-rose-100">データを取得できませんでした</h1>
      <p className="mt-3 text-sm text-rose-100/90">
        バックエンドAPIが起動中の可能性があります。{countdown}秒後に自動で再試行します。
      </p>
      <p className="mt-3 rounded-xl border border-rose-400/30 bg-canvas/50 p-3 text-xs text-rose-100">
        {error.message}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => { setCountdown(RETRY_SECONDS); reset(); }}
          className="rounded-full bg-rose-100 px-4 py-2 text-sm font-black text-rose-950"
        >
          今すぐ再試行
        </button>
        <span className="text-xs text-rose-200/70">{countdown}秒後に自動再試行...</span>
      </div>
    </section>
  );
}
