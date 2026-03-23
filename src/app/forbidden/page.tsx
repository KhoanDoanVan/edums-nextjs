import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">403 - Forbidden</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Tai khoan hien tai khong co quyen truy cap khu vuc nay.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Ve dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Dang nhap tai khoan khac
          </Link>
        </div>
      </section>
    </main>
  );
}
