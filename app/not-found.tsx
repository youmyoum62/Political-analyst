import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-2xl font-black text-ink">ページが見つかりません</h1>
      <p className="mt-3 text-sm text-muted">
        お探しのページは削除されたか、URLが変更された可能性があります。
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-accent px-4 py-2 text-sm font-black text-canvas"
        >
          トップへ戻る
        </Link>
        <Link
          href="/ranking"
          className="rounded-full border border-line px-4 py-2 text-sm font-black text-ink"
        >
          全議員ランキングを見る
        </Link>
      </div>
    </section>
  );
}
