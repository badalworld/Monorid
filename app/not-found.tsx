import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center justify-center p-4 text-center font-mono">
      <div className="p-8 rounded-2xl border border-cyan-500/30 bg-[#070c17]/90 max-w-md w-full space-y-4">
        <h2 className="text-3xl font-black text-cyan-400">404</h2>
        <p className="text-sm text-slate-300 font-semibold">QUANT ROUTE NOT FOUND</p>
        <p className="text-xs text-slate-500">
          The requested futures endpoint or market view does not exist.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all glow-cyan"
        >
          Return to Monorid Dashboard
        </Link>
      </div>
    </div>
  );
}
