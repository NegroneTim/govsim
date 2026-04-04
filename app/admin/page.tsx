"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [plannedAttendeeCount, setPlannedAttendeeCount] = useState("25");
  const [createdPlannedCount, setCreatedPlannedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createSession() {
    setLoading(true);
    setError(null);
    try {
      const raw = parseInt(plannedAttendeeCount, 10);
      const normalized = Math.max(0, Number.isNaN(raw) ? 0 : raw);
      const res = await fetch("/api/admin/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedAttendeeCount: normalized }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Хуралдаан үүсгэж чадсангүй.");
        return;
      }
      const data: { code: string; adminKey: string; plannedAttendeeCount?: number } = await res.json();
      setCode(data.code);
      setAdminKey(data.adminKey);
      setCreatedPlannedCount(data.plannedAttendeeCount ?? normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-2xl items-center px-5 py-10 md:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 right-0 h-[40%] w-[40%] rounded-full bg-amber-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}
          className="group mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Буцах
        </button>

        <div className="mb-10">
          <div className="inline-block rounded-lg bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-500 ring-1 ring-amber-500/20">
            Admin Control
          </div>
          <h1 className="oswald-ui mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl uppercase">Танхимын удирдлага</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Шинэ санал хураалтын хуралдаан үүсгэж, нууц түлхүүр олгоно. Түлхүүрийг аюулгүй хадгална уу.
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Хуралдаанд оролцох хүний тоо</label>
              <input
                type="number"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xl font-bold text-white outline-none transition focus:border-amber-500/50 focus:bg-white/10"
                value={plannedAttendeeCount}
                onChange={(e) => setPlannedAttendeeCount(e.target.value)}
              />
            </div>

            <button
              onClick={createSession}
              disabled={loading}
              className="h-14 w-full rounded-2xl bg-white text-sm font-black uppercase tracking-widest text-slate-950 transition-all hover:bg-amber-500 hover:text-white active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Үүсгэж байна..." : "Хуралдаан үүсгэх"}
            </button>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-medium text-red-400">
                {error}
              </div>
            )}
          </div>

          {code && adminKey && (
            <div className="mt-8 space-y-6 border-t border-white/10 pt-8 animate-in fade-in slide-in-from-top-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Хуралдааны код</div>
                  <div className="oswald-ui mt-1 text-3xl font-bold tracking-[0.2em] text-white">{code}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Төлөвлөсөн ирц</div>
                  <div className="oswald-ui mt-1 text-3xl font-bold text-white">{createdPlannedCount ?? 0}</div>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/20">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Нууц админ түлхүүр</div>
                <div className="mt-1 font-mono text-xs font-medium text-amber-200/80 break-all">{adminKey}</div>
              </div>

            <Link
              href={`/admin/session/${code}?key=${encodeURIComponent(adminKey)}&planned=${encodeURIComponent(String(createdPlannedCount ?? 0))}`}
              className="flex h-14 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-blue-500 active:scale-[0.98]"
            >
              Удирдлагын самбар нээх
            </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
