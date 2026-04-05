'use client';
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [isPageVisible, setIsPageVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsPageVisible(true), 10);
  }, []);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl items-center px-5 py-10 md:px-8">
      {/* Background decoration with animations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px] animate-float-slow" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-emerald-600/10 blur-[120px] animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 h-[50%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/5 blur-[100px] animate-pulse-glow" />
      </div>

      <main className="relative z-10 w-full space-y-10">
        <div className={`text-center transition-all duration-700 ease-out ${
          isPageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 backdrop-blur-md shadow-inner transition-all duration-500 hover:scale-105 hover:border-white/20">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Official Voting System v2.0
          </div>
          <h1 className="oswald-ui mt-6 text-5xl font-bold tracking-tighter text-white sm:text-6xl md:text-8xl">
            ЦАХИМ <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">ТАНХИМ</span>
          </h1>
          <p className={`mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/50 md:text-base transition-all duration-500 delay-200 ${
            isPageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            Албан ёсны санал хураалт болон ирцийн бүртгэлийг бодит цагийн горимд удирдах систем.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className={`group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-10 transition-all duration-500 hover:border-blue-500/30 hover:bg-white/[0.08] hover:shadow-[0_0_80px_-20px_rgba(59,130,246,0.15)] ${
            isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
          }`} style={{ transitionDelay: "100ms" }}>
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/30">
                <svg viewBox="0 0 24 24" className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                </svg>
              </div>
              <h2 className="oswald-ui text-3xl font-bold text-white uppercase tracking-tight">Нэгдэх</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">6 оронтой код болон овог нэрээ ашиглан танхимд нэвтэрч, саналаа өгнө үү.</p>
            </div>
            <Link
              className="group/btn mt-8 inline-flex h-14 items-center justify-center rounded-2xl bg-white text-base font-bold text-slate-950 transition-all duration-300 hover:bg-blue-400 hover:text-white hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
              href="/join"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                Нэгдэх
                <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
            </Link>
          </section>

          <section className={`group relative hidden md:flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/5 bg-white/5 p-10 transition-all duration-500 hover:border-emerald-500/30 hover:bg-white/[0.08] hover:shadow-[0_0_80px_-20px_rgba(16,185,129,0.15)] ${
            isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
          }`} style={{ transitionDelay: "200ms" }}>
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-500/30">
                <svg viewBox="0 0 24 24" className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h2 className="oswald-ui text-3xl font-bold text-white uppercase tracking-tight">Үүсгэх</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">Шинэ хуралдаан үүсгэж, гишүүдийг удирдах, үр дүнг хянах самбар руу нэвтрэх.</p>
            </div>
            <Link
              className="group/btn mt-8 inline-flex h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-base font-bold text-white transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:border-white/30 active:scale-[0.98] relative overflow-hidden"
              href="/admin"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                Үүсгэх
                <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
            </Link>
          </section>
        </div>
      </main>

      <style jsx>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(5%, 5%) scale(1.05);
          }
        }
        
        @keyframes float-delayed {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-5%, -5%) scale(1.08);
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
        
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
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
        
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s linear infinite;
        }
        
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}