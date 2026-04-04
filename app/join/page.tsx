"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function normalizeSessionCode(code: string) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

const MEMBER_NAME_PATTERN = /^[А-ЯӨҮЁ][а-яөүё]+(?:-[А-ЯӨҮЁ][а-яөүё]+)*\.[А-ЯӨҮЁ]$/u;

export default function JoinPage() {
  const router = useRouter();

  const [sessionCode, setSessionCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeFromQr, setCodeFromQr] = useState("");

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    setCodeFromQr(qp.get("code") ?? "");
  }, []);

  useEffect(() => {
    if (!codeFromQr) return;
    setSessionCode(normalizeSessionCode(codeFromQr));
  }, [codeFromQr]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = normalizeSessionCode(codeFromQr || sessionCode);
    const name = fullName.trim();

    if (!/^\d{6}$/.test(code)) {
      setError("Хуралдааны код яг 6 оронтой тоо байх ёстой.");
      return;
    }
    if (!MEMBER_NAME_PATTERN.test(name)) {
      setError("Нэрийг Батмөнх.А эсвэл Энх-Ариун.О хэлбэрээр оруулна уу.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, fullName: name }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Хуралдаанд нэгдэж чадсангүй.");
        return;
      }

      const data: { memberId: string; token: string } = await res.json();

      localStorage.setItem("govsim_member_token", data.token);
      localStorage.setItem("govsim_member_session_code", code);
      localStorage.setItem("govsim_member_id", data.memberId);
      localStorage.setItem("govsim_member_full_name", name);

      router.push(`/session/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-lg items-center px-5 py-10 md:px-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[50%] w-[50%] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          className="group mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Буцах
        </button>

        <div className="mb-8">
          <div className="inline-block rounded-lg bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 ring-1 ring-blue-500/20">
            Membership Access
          </div>
          <h1 className="oswald-ui mt-4 text-3xl font-bold text-white md:text-5xl">ХУРАЛДААНД НЭГДЭХ</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Танхимын системд нэвтрэхийн тулд 6 оронтой код болон овог нэрээ оруулна уу.
          </p>
        </div>

        <form
          className="space-y-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
          onSubmit={onSubmit}
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Хуралдааны код</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xl font-bold tracking-[0.3em] text-white outline-none transition focus:border-blue-500/50 focus:bg-white/10 disabled:opacity-50"
              inputMode="numeric"
              placeholder="000000"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              maxLength={8}
              autoComplete="off"
              disabled={!!codeFromQr}
            />
            {codeFromQr && <p className="text-[10px] text-emerald-400/80 ml-1 font-medium">✓ QR код идэвхжсэн</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Бүтэн нэр (Овог.Н)</label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg font-medium text-white outline-none transition focus:border-blue-500/50 focus:bg-white/10"
              placeholder="Батмөнх.А"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-medium text-red-400">
              {error}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="h-14 w-full rounded-2xl bg-white text-sm font-black uppercase tracking-widest text-slate-950 transition-all hover:bg-blue-400 hover:text-white active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Бүртгэж байна..." : "Хуралдаанд орох"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
