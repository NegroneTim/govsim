import Link from "next/link";

export default function Home() {
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-10 md:px-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      <main className="relative z-10 w-full space-y-10">
        <div className="text-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 backdrop-blur-md shadow-inner">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Official Voting System v2.0
          </div>
          <h1 className="oswald-ui mt-6 text-5xl font-bold tracking-tighter text-white sm:text-6xl md:text-8xl">
            ЦАХИМ <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">ТАНХИМ</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/50 md:text-base">
            Албан ёсны санал хураалт болон ирцийн бүртгэлийг бодит цагийн горимд удирдах систем.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-10 transition-all hover:border-blue-500/30 hover:bg-white/[0.08] hover:shadow-[0_0_80px_-20px_rgba(59,130,246,0.15)]">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                </svg>
              </div>
              <h2 className="oswald-ui text-3xl font-bold text-white uppercase tracking-tight">Нэгдэх</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">6 оронтой код болон овог нэрээ ашиглан танхимд нэвтэрч, саналаа өгнө үү.</p>
            </div>
            <Link
              className="group/btn mt-8 inline-flex h-14 items-center justify-center rounded-2xl bg-white text-base font-bold text-slate-950 transition-all hover:bg-blue-400 hover:text-white active:scale-[0.98]"
              href="/join"
            >
              Нэгдэх
            </Link>
          </section>

          <section className="group relative hidden flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/5 bg-white/5 p-10 transition-all hover:border-emerald-500/30 hover:bg-white/[0.08] hover:shadow-[0_0_80px_-20px_rgba(16,185,129,0.15)] md:flex">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h2 className="oswald-ui text-3xl font-bold text-white uppercase tracking-tight">Үүсгэх</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">Шинэ хуралдаан үүсгэж, гишүүдийг удирдах, үр дүнг хянах самбар руу нэвтрэх.</p>
            </div>
            <Link
              className="mt-8 inline-flex h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-base font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
              href="/admin"
            >
              Үүсгэх
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
