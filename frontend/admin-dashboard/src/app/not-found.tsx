import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy-950 text-white p-6 text-center">
      <div className="relative h-12 w-48 mb-6">
        <Image
          src="/logo-full-dark.png"
          alt="MaidKaro"
          fill
          sizes="192px"
          className="object-contain"
          priority
        />
      </div>
      <div className="max-w-md space-y-4">
        <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300">
          404 — Page Not Found
        </span>
        <h1 className="text-2xl font-bold text-slate-100">
          The requested page does not exist.
        </h1>
        <p className="text-sm text-slate-400">
          You may have typed an incomplete URL (for example, <code className="text-amber-300">/lo</code> instead of <code className="text-emerald-400">/login</code>).
        </p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg bg-amber-400 text-navy-950 font-semibold text-sm hover:bg-amber-300 transition-colors shadow-lg"
          >
            Go to Admin Login
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
