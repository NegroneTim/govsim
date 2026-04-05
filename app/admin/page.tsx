"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [plannedAttendeeCount, setPlannedAttendeeCount] = useState("25");
  const [createdPlannedCount, setCreatedPlannedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsPageVisible(true), 10);
  }, []);

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
      {/* Animated Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 right-0 h-[40%] w-[40%] rounded-full bg-amber-600/10 blur-[120px] animate-float-slow" />
        <div className="absolute top-1/4 left-1/4 h-[30%] w-[30%] rounded-full bg-orange-600/5 blur-[100px] animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 h-[50%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-[120px] animate-pulse-glow" />
      </div>

      <div className={`relative z-10 w-full transition-all duration-700 ease-out ${
        isPageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign("/"))}
          className="group mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 transition-all duration-300 hover:text-white hover:translate-x-[-4px] active:scale-95 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Буцах
        </button>

        <div className="mb-10">
          <div className={`inline-block rounded-lg bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-500 ring-1 ring-amber-500/20 transition-all duration-500 hover:scale-105 hover:bg-amber-500/20 ${
            isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          }`} style={{ transitionDelay: "100ms" }}>
            Admin Control
          </div>
          <h1 className={`oswald-ui mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl uppercase transition-all duration-500 ${
            isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          }`} style={{ transitionDelay: "150ms" }}>
            Танхимын удирдлага
          </h1>
          <p className={`mt-3 text-sm leading-relaxed text-white/50 transition-all duration-500 ${
            isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          }`} style={{ transitionDelay: "200ms" }}>
            Шинэ санал хураалтын хуралдаан үүсгэж, нууц түлхүүр олгоно. Түлхүүрийг аюулгүй хадгална уу.
          </p>
        </div>

        <div className={`rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-700 ${
          isPageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`} style={{ transitionDelay: "250ms" }}>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                Хуралдаанд оролцох хүний тоо
              </label>
              <input
                type="number"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xl font-bold text-white outline-none transition-all duration-300 hover:scale-[1.02] hover:border-white/20 focus:border-amber-500/50 focus:scale-[1.02] focus:bg-white/10"
                value={plannedAttendeeCount}
                onChange={(e) => setPlannedAttendeeCount(e.target.value)}
              />
            </div>

            <button
              onClick={createSession}
              disabled={loading}
              className="relative h-14 w-full rounded-2xl bg-white text-sm font-black uppercase tracking-widest text-slate-950 overflow-hidden transition-all duration-300 hover:bg-amber-500 hover:text-white hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              <span className={`inline-flex items-center justify-center gap-2 transition-all duration-300 ${
                loading ? "opacity-0 translate-y-8" : "opacity-100 translate-y-0"
              }`}>
                Хуралдаан үүсгэх
              </span>
              <span className={`absolute inset-0 inline-flex items-center justify-center gap-2 transition-all duration-300 ${
                loading ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"
              }`}>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Үүсгэж байна...
              </span>
            </button>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-medium text-red-400 animate-shake">
                {error}
              </div>
            )}
          </div>

          {code && adminKey && (
            <div className="mt-8 space-y-6 border-t border-white/10 pt-8 animate-fade-in-up">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition-all duration-300 hover:scale-105 hover:bg-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Хуралдааны код</div>
                  <div className="oswald-ui mt-1 text-3xl font-bold tracking-[0.2em] text-white">{code}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition-all duration-300 hover:scale-105 hover:bg-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Төлөвлөсөн ирц</div>
                  <div className="oswald-ui mt-1 text-3xl font-bold text-white">{createdPlannedCount ?? 0}</div>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/20 transition-all duration-300 hover:scale-[1.02] hover:bg-amber-500/15">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Нууц админ түлхүүр</div>
                <div className="mt-1 font-mono text-xs font-medium text-amber-200/80 break-all">{adminKey}</div>
              </div>

              <Link
                href={`/admin/session/${code}?key=${encodeURIComponent(adminKey)}&planned=${encodeURIComponent(String(createdPlannedCount ?? 0))}`}
                className="group/btn relative flex h-14 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black uppercase tracking-widest text-white overflow-hidden transition-all duration-300 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  Удирдлагын самбар нээх
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-5%, -5%) scale(1.1);
          }
        }
        
        @keyframes float-delayed {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(5%, 5%) scale(1.08);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-2px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(2px);
          }
        }
        
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 6s ease-in-out infinite;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}