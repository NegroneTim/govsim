"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type PollResponse = {
  poll: {
    id: string;
    problem: string;
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    isActive: boolean;
    status: "open" | "closed";
  } | null;
  myVote: "approve" | "deny" | null;
  member: { fullName: string } | null;
  handRaisedAt: string | null;
  isSpeechMode?: boolean;
  results?: {
    totalVotes: number;
    approveCount: number;
    denyCount: number;
    approvePercent: number;
    denyPercent: number;
  } | null;
};

export default function SessionPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const code = params.code;
  const [token, setToken] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);

  const [data, setData] = useState<PollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [voteStatusType, setVoteStatusType] = useState<"success" | "error">("success");
  const [showVoteToast, setShowVoteToast] = useState(false);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const hasLeftRef = useRef(false);
  const [handLoading, setHandLoading] = useState(false);

  // Клиент талын цагийг секунд тутам шинэчлэх
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Санал хураалт идэвхтэй эсэхийг хугацаатай нь тулгаж шалгах
  const pollActive = useMemo(() => {
    if (!data?.poll?.isActive) return false;
    const endsAt = new Date(data.poll.endsAt).getTime();
    return now < endsAt;
  }, [data?.poll, now]);

  // Санал хураалт дууссанаас хойш 10 секунд хүртэл "Амжилттай" төлөвийг хадгалах (Grace period)
  const isGracePeriod = useMemo(() => {
    if (!data?.poll?.endsAt || data?.results) return false;
    const endsAt = new Date(data.poll.endsAt).getTime();
    return now >= endsAt && now < endsAt + 10000;
  }, [data?.poll?.endsAt, data?.results, now]);

  function toFriendlyMessage(raw: string) {
    const t = raw.toLowerCase();
    if (t.includes("no active poll") || t.includes("poll is closed")) {
      return "Санал хураалт эхлээгүй байна.";
    }
    if (t.includes("member not found or kicked")) {
      return "Та хурлаас хасагдсан байна.";
    }
    if (t.includes("missing authorization token")) {
      return "Нэвтрэлт хүчингүй байна. Дахин нэвтэрнэ үү.";
    }
    return "Үйлдэл амжилтгүй боллоо.";
  }

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/session/${code}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        if (text.toLowerCase().includes("member not found or kicked")) {
          clearMemberStorage();
          router.replace("/");
          return;
        }
        setError(toFriendlyMessage(text || "Санал ачаалж чадсангүй."));
        return;
      }

      const raw: any = await res.json();
      // Өгөгдлийн түлхүүрүүдийг camelCase руу хөрвүүлэх (баталгаажуулалт)
      const json: PollResponse = {
        ...raw,
        poll: raw.poll ? {
          ...raw.poll,
          isActive: raw.poll.isActive ?? raw.poll.is_active,
          status: raw.poll.status,
          endsAt: raw.poll.endsAt ?? raw.poll.ends_at,
        } : null,
        handRaisedAt: raw.handRaisedAt ?? raw.hand_raised_at ?? null,
        isSpeechMode: !!(raw.isSpeechMode ?? raw.is_speech_mode),
      };

      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    }
  }, [code, token]);

  // Санал хураалт дуусах мөчийг хянах (Яг 0 секунд болоход)
  useEffect(() => {
    // Хэрэв сервер дээр нээлттэй байгаа ч клиент талд хугацаа дууссан бол
    if (data?.poll?.isActive && !pollActive) {
      // Сервер дээр санал хаагдах (auto-deny) логикийг хүлээж бага зэрэг (800ms) саатуулж өгөгдөл татна
      const timer = setTimeout(() => {
        void fetchData();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pollActive, data?.poll?.isActive, fetchData]);

  function triggerVoteToast(text: string, type: "success" | "error" = "success") {
    setVoteStatusType(type);
    setVoteStatus(text);
    setShowVoteToast(true);
    window.setTimeout(() => setShowVoteToast(false), 1500);
    window.setTimeout(() => setVoteStatus(null), 2100);
  }

  useEffect(() => {
    const t = localStorage.getItem("govsim_member_token");
    const storedCode = localStorage.getItem("govsim_member_session_code");
    const storedName = localStorage.getItem("govsim_member_full_name");
    if (!t || !storedCode || storedCode !== code) {
      setToken(null);
      setMemberName(null);
      return;
    }
    setToken(t);
    setMemberName(storedName);
    setReady(true);
  }, [code]);

  /** Initial load */
  useEffect(() => {
    if (token) {
      void fetchData();
    }
  }, [token, fetchData]);

  /** Real-time subscription to poll changes */
  useEffect(() => {
    if (!code || !token || !supabase) return;

    const channel = supabase
      .channel(`member_realtime_${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "polls",
          filter: `session_code=eq.${code}`,
        },
        () => {
          void fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `code=eq.${code}`,
        },
        (payload:any) => {
          const next = payload.new as any;
          const speechActive = !!(next.is_speech_mode ?? next.isSpeechMode);
          setData((prev) => (prev ? { ...prev, isSpeechMode: speechActive } : prev));
          
          // Only trigger full fetch if other session data changed
          void fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `session_code=eq.${code}`,
        },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, token, fetchData]);

  async function castVote(choice: "approve" | "deny") {
    if (!token) return;

    setLoading(true);
    setError(null);
    setVoteStatus(null);
    setShowVoteToast(false);
    try {
      const res = await fetch(`/api/session/${code}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ choice }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        triggerVoteToast(toFriendlyMessage(text), "error");
        return;
      }

      await res.json().catch(() => null);
      triggerVoteToast("Саналыг хүлээж авлаа.", "success");
      setData((prev) =>
        prev
          ? {
            ...prev,
            myVote: choice,
            poll: prev.poll ? { ...prev.poll, isActive: true } : prev.poll,
          }
          : prev
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
      triggerVoteToast("Сүлжээний алдаа гарлаа.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleHand() {
    if (!token) return;
    setHandLoading(true);
    try {
      const res = await fetch(`/api/session/${code}/raise-hand`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        triggerVoteToast("Үйлдэл амжилтгүй боллоо.", "error");
        return;
      }
      const json = await res.json();
      const handRaisedAt = json.handRaisedAt ?? json.hand_raised_at ?? null;
      setData(prev => prev ? { ...prev, handRaisedAt } : prev);
      triggerVoteToast(handRaisedAt ? "Гар өргөлөө ✋" : "Гар буулгалаа", "success");
    } catch (err) {
      triggerVoteToast("Сүлжээний алдаа.", "error");
    } finally {
      setHandLoading(false);
    }
  }

  function clearMemberStorage() {
    localStorage.removeItem("govsim_member_token");
    localStorage.removeItem("govsim_member_session_code");
    localStorage.removeItem("govsim_member_id");
    localStorage.removeItem("govsim_member_full_name");
  }

  /** Removes your member record on the server, then clears this device */
  async function leaveSession() {
    if (!token) {
      clearMemberStorage();
      router.replace("/");
      return;
    }
    setShowLeaveConfirm(true);
  }

  async function confirmLeaveSession() {
    if (!token) return;
    setShowLeaveConfirm(false);
    setLeaving(true);
    hasLeftRef.current = true; // cleanup-аар дахиж дуудахаас сэргийлнэ
    setError(null);
    try {
      const res = await fetch(`/api/session/${code}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => "");
        setError(text || "Хуралдаанаас гарч чадсангүй.");
        return;
      }
      clearMemberStorage();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-5 py-6 md:px-8">
      {/* Raise Hand Floating Button */}
      {token && data?.isSpeechMode && (
        <button
          type="button"
          onClick={toggleHand}
          disabled={handLoading}
          className={`fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-all active:scale-90 ${data?.handRaisedAt
              ? "bg-amber-500 text-slate-900 ring-4 ring-amber-500/20"
              : "bg-white text-slate-900 hover:bg-blue-500 hover:text-white"
            }`}
        >
          {handLoading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <span className="text-2xl">✋</span>}
        </button>
      )}

      {voteStatus ? (
        <div
          className={[
            "pointer-events-none fixed right-4 top-1/2 z-50 -translate-y-1/2 rounded-l-lg border px-5 py-3 text-sm font-semibold shadow-xl transition-all duration-500",
            showVoteToast ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0",
            voteStatusType === "success"
              ? "border-emerald-400/55 bg-emerald-900/90 text-emerald-100"
              : "border-red-400/55 bg-red-900/90 text-red-100",
          ].join(" ")}
        >
          {voteStatus}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent p-5 md:p-6 shadow-2xl backdrop-blur-xl shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 md:pb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">ХУРАЛДААНЫ ТӨЛӨВ</p>
            <h1 className="oswald-ui mt-1 text-xl font-bold text-white md:text-4xl">
              #{code}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {memberName ? (
                <>
                  Бүртгэгдсэн гишүүн: <span className="font-medium text-white">{memberName}</span>
                </>
              ) : (
                "Санал өгөхийн тулд гишүүний нэвтрэлтээр орно уу."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void leaveSession()}
              disabled={leaving}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-60"
            >
              {leaving ? "…" : "Хуралдаанаас гарах"}
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-400/45 bg-red-900/35 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
      </div>

      {showLeaveConfirm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#003d60]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/30 bg-[#0069a3] p-5 shadow-2xl">
            <h4 className="text-lg font-semibold text-white">Баталгаажуулалт</h4>
            <p className="mt-2 text-sm text-white/90">
              Энэ хуралдаанаас гарах уу? Ижил код, нэрээр дахин нэгдэж болно.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d]"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={() => void confirmLeaveSession()}
                className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/60"
              >
                Тийм
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {token ? (
        <div className="mt-6 flex-1 flex flex-col min-h-0">
          {pollActive ? (
            data?.myVote ? (
              <div className="flex flex-col items-center justify-center rounded-[2.5rem] bg-white/5 py-20 text-center backdrop-blur-md">
                <div className="mb-6 rounded-full bg-emerald-500/10 p-6 text-emerald-400 ring-1 ring-emerald-500/50">
                  <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="oswald-ui text-3xl font-bold text-white">САНАЛ ХҮЛЭЭЖ АВЛАА</p>
                <p className="mt-2 text-sm text-white/50">Таны санал амжилттай бүртгэгдсэн. Үр дүнг хүлээнэ үү.</p>
              </div>
            ) : (
              <>
                <div className={`mb-4 flex items-center justify-center gap-3 rounded-2xl py-3 ring-1 shrink-0 ${pollActive ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-white/5 ring-white/10'}`}>
                  <span className="relative flex h-3 w-3">
                    {pollActive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex h-3 w-3 rounded-full ${pollActive ? 'bg-emerald-500' : 'bg-white/20'}`}></span>
                  </span>
                  <span className={`text-xs font-black uppercase tracking-[0.2em] ${pollActive ? 'text-emerald-400' : 'text-white/40'}`}>
                    {pollActive ? "САНАЛ ХУРААЛТ ИДЭВХТЭЙ" : "САНАЛ ХУРААЛТ ДУУССАН"}
                  </span>
                </div>
                <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  <button
                    type="button"
                    disabled={loading || !pollActive}
                    onClick={() => castVote("approve")}
                    className="group relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[2rem] border border-blue-400/30 bg-blue-600 px-4 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] disabled:grayscale"
                  >
                    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-10 w-10 transition-transform group-hover:scale-110"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M20 7L9 18l-5-5" />
                    </svg>
                    <span className="oswald-ui text-xl font-bold uppercase tracking-wider">Зөвшөөрөх</span>
                    <div className="absolute inset-0 translate-y-full bg-gradient-to-t from-white/20 to-transparent transition-transform group-hover:translate-y-0" />
                  </button>
                  <button
                    type="button"
                    disabled={loading || !pollActive}
                    onClick={() => castVote("deny")}
                    className="group relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[2rem] border border-amber-400/30 bg-amber-600 px-4 transition-all hover:bg-amber-500 active:scale-95 disabled:opacity-50 shadow-[0_20px_40px_-10px_rgba(217,119,6,0.4)] disabled:grayscale"
                  >
                    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-10 w-10 transition-transform group-hover:scale-110"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                    <span className="oswald-ui text-xl font-bold uppercase tracking-wider">Татгалзах</span>
                    <div className="absolute inset-0 translate-y-full bg-gradient-to-t from-white/20 to-transparent transition-transform group-hover:translate-y-0" />
                  </button>
                </div>
              </>
            )
          ) : data?.results ? (
              <div className="flex flex-col items-center justify-center rounded-[2.5rem] bg-white/5 p-6 md:p-10 text-center backdrop-blur-md flex-1">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">RESULT</div>
                <h2 className="oswald-ui text-2xl md:text-3xl font-bold text-white uppercase">Санал хураалтын дүн</h2>
                <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="group relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 md:p-6 transition-all hover:bg-emerald-500/20">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Зөвшөөрсөн</div>
                    <div className="mt-2 text-4xl md:text-5xl font-black text-white">{data.results.approveCount}</div>
                    <div className="mt-1 text-sm font-medium text-emerald-400/70">{data.results.approvePercent.toFixed(1)}%</div>
                  </div>
                  <div className="group relative overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 md:p-6 transition-all hover:bg-amber-500/20">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Татгалзсан</div>
                    <div className="mt-2 text-4xl md:text-5xl font-black text-white">{data.results.denyCount}</div>
                    <div className="mt-1 text-sm font-medium text-amber-400/70">{data.results.denyPercent.toFixed(1)}%</div>
                  </div>
                </div>
                <p className="mt-8 text-xs font-medium uppercase tracking-widest text-white/30 animate-pulse">Дараагийн асуудал орохыг хүлээнэ үү</p>
              </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] bg-white/5 py-10 text-center flex-1">
              {data?.poll?.isActive ? (
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              ) : (
                <div className="mb-6 animate-pulse rounded-full bg-white/10 p-6 text-white/40">
                  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <p className="text-xl font-medium tracking-tight text-white/70">
                {data?.poll?.isActive ? "Үр дүнг нэгтгэж байна..." : "Санал хураалт эхлэхийг хүлээнэ үү..."}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
