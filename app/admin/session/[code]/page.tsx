"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ProgressCircle } from "@heroui/react";

type ScreenResponse = {
  sessionCode: string;
  nowISO: string;
  poll: {
    id: string;
    problem: string;
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    closedAt: string | null;
    status: "open" | "closed";
    isActive: boolean;
    anonymous?: boolean;
  } | null;
  results: null | {
    totalVotes: number;
    approveCount: number;
    denyCount: number;
    approvePercent: number;
    denyPercent: number;
    approve: Array<{ memberId: string; fullName: string }>;
    deny: Array<{ memberId: string; fullName: string }>;
    anonymous?: boolean;
  };
  attendance?: {
    eligibleMemberCount: number;
    plannedAttendeeCount?: number;
    votesCastCount: number;
    voteParticipationPercent: number;
  };
};

type AdminMember = {
  id: string;
  fullName: string;
  joinedAt: string;
  hand_raised_at?: string | null;
  handRaisedAt: string | null;
  kickedAt: string | null;
};

type ActiveDisplayPhase = "setup" | "countdown";

const DEMO_VOTER_COUNT = 50;

/** Shown when ?demo=1 and there are no API results yet (layout / credits testing) */
const DEMO_PREVIEW_RESULTS: NonNullable<ScreenResponse["results"]> = {
  totalVotes: 100,
  approveCount: 50,
  denyCount: 50,
  approvePercent: 50,
  denyPercent: 50,
  approve: [],
  deny: [],
  anonymous: false,
};

function createRand(seed: number) {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DUMMY_GIVEN = [
  "Батбаяр",
  "Энхбат",
  "Оюун",
  "Саран",
  "Мөнх",
  "Ариунаа",
  "Ганбаатар",
  "Наран",
  "Төмөр",
  "Энхжин",
  "Болд",
  "Сүхбаатар",
  "Цэцэг",
  "Дорж",
  "Эрдэнэ",
] as const;

const DUMMY_FAMILY = [
  "Батбаяр",
  "Гансүх",
  "Оюунболд",
  "Санжаасүрэн",
  "Мөнхбат",
  "Энхтуяа",
  "Батмөнх",
  "Наранцогт",
  "Төмөрбат",
  "Доржсүрэн",
  "Эрдэнэбат",
  "Болормаа",
  "Ганзориг",
  "Сүрэнжав",
  "Цэцэгмаа",
] as const;

/** One pool of DEMO_VOTER_COUNT names, each randomly assigned to approve or deny (stable per seed) */
function buildRandomSplitDummyVoters(seed: number): {
  approve: Array<{ memberId: string; fullName: string }>;
  deny: Array<{ memberId: string; fullName: string }>;
} {
  const randName = createRand(seed);
  const pool: Array<{ memberId: string; fullName: string }> = [];
  for (let i = 0; i < DEMO_VOTER_COUNT; i++) {
    const g = DUMMY_GIVEN[Math.floor(randName() * DUMMY_GIVEN.length)];
    const f = DUMMY_FAMILY[Math.floor(randName() * DUMMY_FAMILY.length)];
    pool.push({
      memberId: `demo-${i}`,
      fullName: `${g} ${f} (${i + 1})`,
    });
  }
  const randSide = createRand(seed ^ 0xdeadbeef);
  const approve: Array<{ memberId: string; fullName: string }> = [];
  const deny: Array<{ memberId: string; fullName: string }> = [];
  for (const v of pool) {
    if (randSide() < 0.5) {
      approve.push({ memberId: `${v.memberId}-z`, fullName: v.fullName });
    } else {
      deny.push({ memberId: `${v.memberId}-t`, fullName: v.fullName });
    }
  }
  return { approve, deny };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AdminSessionPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const code = params.code;
  const adminKey = searchParams.get("key") ?? "";
  const demoParam = searchParams.get("demo");
  const demoMode =
    demoParam != null &&
    demoParam !== "" &&
    !["0", "false", "no", "off"].includes(demoParam.toLowerCase());

  const [pollFromScreen, setPollFromScreen] = useState<ScreenResponse["poll"]>(null);
  const [results, setResults] = useState<ScreenResponse["results"]>(null);
  const [attendance, setAttendance] = useState<ScreenResponse["attendance"] | null>(null);
  const [starting, setStarting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [forceAttendanceView, setForceAttendanceView] = useState(false);
  const [confirmModal, setConfirmModal] = useState<null | { type: "kick"; memberId: string }>(null);
  const [tick, setTick] = useState(0);
  const [nowISO, setNowISO] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [receiveAt, setReceiveAt] = useState<number | null>(null);
  const [setupStartedAt, setSetupStartedAt] = useState<number | null>(null);
  const [activeDisplayPhase, setActiveDisplayPhase] = useState<ActiveDisplayPhase>("countdown");
  const autoClosedPollRef = useRef<string | null>(null);
  const receivePollIdRef = useRef<string | null>(null);
  const setupTimeoutRef = useRef<number | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  const xAdminKey = mounted ? adminKey : "";
  const plannedFromQuery = Number.parseInt(searchParams.get("planned") ?? "", 10);

  const loadScreen = useCallback(async () => {
    const res = await fetch(`/api/session/${code}/screen`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      setApiError(errJson.error || "Холболтын алдаа гарлаа.");
      return;
    }
    setApiError(null);
    const json: ScreenResponse = await res.json();
    setPollFromScreen(json.poll);
    setResults(json.results);
    setAttendance(json.attendance ?? null);
    const p = json.poll;
    if (p?.isActive) {
      if (receivePollIdRef.current !== p.id) {
        receivePollIdRef.current = p.id;
        setSetupStartedAt(Date.now());
        setActiveDisplayPhase("setup");
        const audio = new Audio("/api/audio/countdown-start");
        audio.volume = 1;
        void audio.play().catch(() => {
          /* ignore autoplay block; user interaction will enable next attempt */
        });
        if (setupTimeoutRef.current != null) {
          window.clearTimeout(setupTimeoutRef.current);
        }
        setupTimeoutRef.current = window.setTimeout(() => {
          setReceiveAt(Date.now());
          setSetupStartedAt(null);
          setActiveDisplayPhase("countdown");
          setupTimeoutRef.current = null;
        }, 3000);
      }
    } else {
      if (setupTimeoutRef.current != null) {
        window.clearTimeout(setupTimeoutRef.current);
        setupTimeoutRef.current = null;
      }
      receivePollIdRef.current = null;
      setSetupStartedAt(null);
      setReceiveAt(null);
      setActiveDisplayPhase("countdown");
    }
  }, [code]);

  const loadMembers = useCallback(
    async (kind: "load" | "refresh" = "load") => {
      if (!xAdminKey) return;
      if (kind === "load") setMembersLoading(true);
      if (kind === "refresh") setRefreshingMembers(true);
      try {
        const res = await fetch(`/api/admin/sessions/${code}/members`, {
          headers: { "X-Admin-Key": xAdminKey },
        });
        if (!res.ok) {
          return;
        }
        const json: { members: AdminMember[] } = await res.json();
        setMembers(
          json.members
            .map((m) => ({ ...m, handRaisedAt: m.handRaisedAt ?? m.hand_raised_at ?? null }))
            .filter((m) => !m.kickedAt)
        );
      } finally {
        if (kind === "load") setMembersLoading(false);
        if (kind === "refresh") setRefreshingMembers(false);
      }
    },
    [xAdminKey, code]
  );

  useEffect(() => {
    setNowISO(new Date().toISOString());
    const id = window.setInterval(() => {
      setNowISO(new Date().toISOString());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  // Эхлэлд гишүүдийг нэг удаа ачаалах (Гар өргөлт хянахад хэрэгтэй)
  useEffect(() => {
    if (mounted && xAdminKey) {
      void loadMembers("load");
    }
  }, [mounted, xAdminKey, loadMembers]);

  // Гишүүн нэмэгдэх (Ирц) болон Санал өгөх үйлдэл (Realtime)
  useEffect(() => {
    if (!code || !mounted || !supabase || typeof supabase.channel !== "function") return;

    const channel = supabase
      .channel(`admin_realtime_${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `session_code=eq.${code}`,
        },
        () => {
          // Ирцийн мэдээллийг шинэчлэх
          void loadScreen();
          // Гар өргөлтийг хянахын тулд гишүүдийг байнга шинэчилнэ
          void loadMembers("refresh");
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "votes",
            filter: `session_code=eq.${code}`,
          },
          () => {
            void loadScreen();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, mounted, loadScreen, loadMembers, showMembers]);

  useEffect(() => {
    if (!pollFromScreen?.isActive) return;
    const id = window.setInterval(() => {
      void loadScreen();
    }, 1000);
    return () => window.clearInterval(id);
  }, [pollFromScreen?.isActive, loadScreen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key?.toLowerCase();
      if (!key || !["q", "a", "s", "e", "r", "x"].includes(key)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext =
        !!target &&
        (target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
      if (isTypingContext) return;
      e.preventDefault();
      if (key === "q") {
        setShowQr((v) => !v);
        return;
      }
      if (key === "e") {
        void openMembersPanel();
        return;
      }
      if (key === "r") {
        void loadScreen();
        return;
      }
      if (key === "x") {
        setForceAttendanceView(true);
        return;
      }
      if (key === "a") {
        void startPoll(true);
        return;
      }
      if (key === "s") {
        void startPoll(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pollFromScreen?.isActive, xAdminKey, code, loadMembers, loadScreen]);

  useEffect(() => {
    if (!pollFromScreen?.isActive) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [pollFromScreen?.isActive, pollFromScreen?.endsAt]);

  const remaining = useMemo(() => {
    if (!pollFromScreen?.isActive || activeDisplayPhase !== "countdown" || receiveAt == null) return null;
    void tick;
    return Math.max(
      0,
      (pollFromScreen.durationSeconds ?? 0) - Math.floor((Date.now() - receiveAt) / 1000)
    );
  }, [pollFromScreen?.isActive, pollFromScreen?.durationSeconds, receiveAt, tick, activeDisplayPhase]);

  const setupRemaining = useMemo(() => {
    if (activeDisplayPhase !== "setup" || !setupStartedAt) return null;
    void tick;
    const elapsed = Math.floor((Date.now() - setupStartedAt) / 1000);
    return Math.max(1, 3 - elapsed);
  }, [activeDisplayPhase, setupStartedAt, tick]);

  const currentAttendance = attendance?.eligibleMemberCount ?? 0;
  const plannedAttendanceRaw = attendance?.plannedAttendeeCount ?? 0;
  const plannedAttendance =
    plannedAttendanceRaw > 0
      ? plannedAttendanceRaw
      : Number.isFinite(plannedFromQuery) && plannedFromQuery > 0
        ? plannedFromQuery
        : Math.max(currentAttendance, 1);
  const attendancePercent =
    plannedAttendance > 0 ? Math.round((currentAttendance / plannedAttendance) * 1000) / 10 : 0;
  const activePollId = pollFromScreen?.id ?? null;
  const isPollActive = pollFromScreen?.isActive === true;
  const dummySplit = useMemo(() => buildRandomSplitDummyVoters(0x9e3779b9), []);

  const resultsForUi = useMemo(() => {
    if (results) return results;
    if (demoMode) return DEMO_PREVIEW_RESULTS;
    return null;
  }, [results, demoMode]);

  const approveDisplay = useMemo(() => {
    if (!resultsForUi || resultsForUi.anonymous) return [];
    return demoMode ? [...resultsForUi.approve, ...dummySplit.approve] : resultsForUi.approve;
  }, [resultsForUi, demoMode, dummySplit.approve]);

  const denyDisplay = useMemo(() => {
    if (!resultsForUi || resultsForUi.anonymous) return [];
    return demoMode ? [...resultsForUi.deny, ...dummySplit.deny] : resultsForUi.deny;
  }, [resultsForUi, demoMode, dummySplit.deny]);

  const resultStatsForScreen = useMemo(() => {
    if (!resultsForUi || resultsForUi.anonymous) return null;
    if (demoMode) {
      const na = approveDisplay.length;
      const nd = denyDisplay.length;
      const t = na + nd;
      return {
        approveCount: na,
        denyCount: nd,
        totalVotes: t,
        approvePercent: t ? (na / t) * 100 : 0,
        denyPercent: t ? (nd / t) * 100 : 0,
      };
    }
    return {
      approveCount: resultsForUi.approveCount,
      denyCount: resultsForUi.denyCount,
      totalVotes: resultsForUi.totalVotes,
      approvePercent: resultsForUi.approvePercent,
      denyPercent: resultsForUi.denyPercent,
    };
  }, [resultsForUi, demoMode, approveDisplay.length, denyDisplay.length]);

  // Гараа өргөсөн гишүүдийг хугацаагаар нь эрэмбэлж харуулах
  const raisedHandsQueue = useMemo(() => {
    return members
      .filter(m => m.handRaisedAt && !m.kickedAt)
      .sort((a, b) => new Date(a.handRaisedAt!).getTime() - new Date(b.handRaisedAt!).getTime());
  }, [members]);

  async function lowerAllHands() {
    if (!xAdminKey) return;
    try {
      const res = await fetch(`/api/admin/session/${code}/lower-all`, {
        method: "POST",
        headers: { "X-Admin-Key": xAdminKey },
      });
      if (res.ok) {
        setMembers(prev => prev.map(m => ({ ...m, handRaisedAt: null })));
      }
    } catch (err) {
      console.error("Failed to lower hands", err);
    }
  }

  /** One full scroll cycle (seconds). Short lists stay readable; long lists cap so the roll doesn’t crawl. */
  const creditsDurationSec = useMemo(() => {
    if (!resultsForUi) return 24;
    if (resultsForUi.anonymous) return 24;
    const totalNames = approveDisplay.length + denyDisplay.length;
    return Math.max(10, Math.min(28, 10 + totalNames * 0.25));
  }, [resultsForUi, approveDisplay.length, denyDisplay.length]);
  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
  }, [code]);

  useEffect(() => {
    if (!showQr || !qrRef.current || !joinUrl) return;
    let cancelled = false;
    void import("qr-creator").then((mod) => {
      if (cancelled || !qrRef.current) return;
      const QrCreator = mod.default;
      qrRef.current.innerHTML = "";
      QrCreator.render(
        {
          text: joinUrl,
          ecLevel: "H",
          radius: 0.2,
          fill: "#003d60",
          background: "#ffffff",
          size: 520,
        },
        qrRef.current
      );
    });
    return () => {
      cancelled = true;
    };
  }, [showQr, joinUrl]);

  async function startPoll(anonymous: boolean) {
    if (!xAdminKey) return;
    if (pollFromScreen?.isActive) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${code}/poll/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": xAdminKey,
        },
        body: JSON.stringify({
          durationSeconds: 10,
          anonymous,
        }),
      });
      if (!res.ok) {
        return;
      }
      await res.json().catch(() => null);
      setForceAttendanceView(false);
      await loadScreen();
    } finally {
      setStarting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function openMembersPanel() {
    setShowMembers(true);
    await loadMembers("load");
  }

  async function kickMember(memberId: string) {
    if (!xAdminKey) return;
    setKickingMemberId(memberId);
    try {
      const res = await fetch(
        `/api/admin/sessions/${code}/members/${encodeURIComponent(memberId)}/kick`,
        {
          method: "POST",
          headers: { "X-Admin-Key": xAdminKey },
        }
      );
      if (!res.ok) {
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } finally {
      setKickingMemberId(null);
    }
  }

  const closePoll = useCallback(async () => {
    if (!xAdminKey) return;
    const res = await fetch(`/api/admin/sessions/${code}/poll/close`, {
      method: "POST",
      headers: { "X-Admin-Key": xAdminKey },
    });
    if (!res.ok) {
      return;
    }
    await loadScreen();
  }, [xAdminKey, code, loadScreen]);

  useEffect(() => {
    if (!isPollActive) {
      autoClosedPollRef.current = null;
      return;
    }
    if (remaining == null) return;
    if (remaining > 0) return;
    if (!activePollId) return;
    if (autoClosedPollRef.current === activePollId) return;
    autoClosedPollRef.current = activePollId;
    void closePoll();
  }, [activePollId, isPollActive, remaining, closePoll]);

  // Бүх хүн санал өгсөн бол автоматаар хаах
  useEffect(() => {
    if (!isPollActive || !attendance || !activePollId) return;
    if (attendance.votesCastCount >= attendance.eligibleMemberCount && attendance.eligibleMemberCount > 0) {
      if (autoClosedPollRef.current === activePollId) return;
      autoClosedPollRef.current = activePollId;
      // Бага зэрэг хүлээлт хийж (0.5с) хаавал илүү үзэмжтэй
      window.setTimeout(() => void closePoll(), 500);
    }
  }, [attendance?.votesCastCount, attendance?.eligibleMemberCount, isPollActive, activePollId, closePoll]);

  async function onConfirmModalApprove() {
    if (!confirmModal) return;
    const current = confirmModal;
    setConfirmModal(null);
    await kickMember(current.memberId);
  }

  // Hydration алдаанаас сэргийлж зөвхөн клиент талд ачаалсны дараа дэлгэцийг харуулна
  if (!mounted) return null;

  return (
    <div className="oswald-ui relative min-h-screen w-full overflow-hidden bg-[#0069a3] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute left-8 top-6 z-20 px-1 py-1 text-lg font-semibold tracking-wide md:left-10 md:top-8 md:text-2xl">
        {nowISO ? formatTime(nowISO) : "--:--:--"}
      </div>
      <button
        type="button"
        onClick={copyCode}
        className="absolute left-1/2 top-6 z-30 -translate-x-1/2 px-4 py-1 text-lg font-semibold tracking-[0.2em] text-white md:top-8 md:text-2xl"
        title="Хуулах"
      >
        {copiedCode ? "Хуулагдлаа" : code}
      </button>
      {apiError && (
        <div className="absolute left-1/2 top-24 z-50 w-full max-w-md -translate-x-1/2 rounded-lg border border-red-400 bg-red-900/90 px-4 py-3 text-center text-white shadow-xl backdrop-blur-md">
          <p className="font-semibold">Алдаа гарлаа:</p>
          <p className="text-sm">{apiError}</p>
        </div>
      )}
      <div className="pointer-events-none absolute right-8 top-6 z-20 px-1 py-1 text-lg font-semibold tracking-wide md:right-10 md:top-8 md:text-2xl">
        {nowISO ? formatDate(nowISO) : "----.--.--"}
      </div>

      {showQr ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#003d60]/80 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setShowQr(false)}
            className="absolute right-4 top-4 rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d] md:right-6 md:top-6"
          >
            Хаах
          </button>
          <div className="rounded-2xl bg-white p-5 shadow-2xl">
            <div ref={qrRef} className="h-[520px] w-[520px]" />
          </div>
        </div>
      ) : null}
      {showMembers ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#003d60]/80 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setShowMembers(false)}
            className="absolute right-4 top-4 rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d] md:right-6 md:top-6"
          >
            Хаах
          </button>
          <div className="w-full max-w-3xl rounded-2xl border border-white/30 bg-[#0069a3] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Хурлын гишүүд</h3>
              <button
                type="button"
                onClick={() => void loadMembers("refresh")}
                disabled={refreshingMembers}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/55 bg-[#005180]/70 text-white hover:bg-[#00659d] disabled:opacity-60"
                title="Шинэчлэх"
                aria-label="Шинэчлэх"
              >
                <svg viewBox="0 0 24 24" className={["h-5 w-5", refreshingMembers ? "animate-spin" : ""].join(" ")} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 10-3.2 6.9" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            </div>

            <div className="max-h-[65vh] space-y-2 overflow-auto pr-1">
              {membersLoading ? (
                <div className="rounded-md border border-white/20 bg-[#005180]/45 px-3 py-3 text-sm text-white/90">
                  Ачаалж байна…
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-md border border-white/20 bg-[#005180]/45 px-3 py-3 text-sm text-white/90">
                  Бүртгэгдсэн гишүүн алга.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-white/25 bg-[#005180]/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">{m.fullName}</div>
                      <div className="text-xs text-white/75">{m.kickedAt ? "Хасагдсан" : "Идэвхтэй"}</div>
                    </div>
                    <button
                      type="button"
                      disabled={!!m.kickedAt || kickingMemberId === m.id}
                      onClick={() => setConfirmModal({ type: "kick", memberId: m.id })}
                      className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-900/60 disabled:opacity-60"
                    >
                      {kickingMemberId === m.id ? "…" : "Хасах"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
      {confirmModal ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#003d60]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/30 bg-[#0069a3] p-5 shadow-2xl">
            <h4 className="text-lg font-semibold text-white">Баталгаажуулалт</h4>
            <p className="mt-2 text-sm text-white/90">
              Энэ гишүүнийг хуралдаанаас хасах уу?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d]"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={() => void onConfirmModalApprove()}
                className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/60"
              >
                Тийм
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {forceAttendanceView || (!pollFromScreen && !demoMode) ? (
        <div className="relative flex min-h-screen items-center justify-center px-6 lg:px-20">
          <div className="relative flex w-full max-w-[1600px] items-center justify-center gap-12 lg:gap-32">
            {/* Ирц - Дэлгэцийн голд */}
            <ProgressCircle.Root
              aria-label="Ирц"
              value={attendancePercent}
              maxValue={100}
              className="relative h-[min(80vw,28rem)] w-[min(80vw,28rem)] lg:h-[36rem] lg:w-[36rem] shrink-0"
            >
              <ProgressCircle.Track className="h-full w-full -rotate-90">
                <ProgressCircle.TrackCircle className="stroke-white/25" strokeWidth={1.5} />
                <ProgressCircle.FillCircle className="stroke-[#fde047]" strokeWidth={1.5} />
              </ProgressCircle.Track>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4">
                <p className="text-4xl font-semibold md:text-6xl">ИРЦ {currentAttendance}/{plannedAttendance}</p>
                <p className="mt-2 text-2xl font-semibold text-white/85 md:text-4xl">{attendancePercent.toFixed(1)}%</p>
              </div>
            </ProgressCircle.Root>

          </div>
        </div>
      ) : pollFromScreen?.isActive ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          {activeDisplayPhase === "setup" ? (
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold uppercase tracking-widest text-white/60 md:text-5xl">
                Санал хураалт эхлэхэд
              </div>
              <div className="mt-10 text-[12rem] font-black leading-none text-[#fde047] md:text-[20rem] animate-pulse">
                {setupRemaining}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 text-3xl font-semibold tracking-wide text-white md:text-5xl">
                Ирц {currentAttendance}/{plannedAttendance} {attendancePercent.toFixed(1)}%
              </div>
              <div className="text-[10rem] font-bold leading-none tabular-nums text-[#fde047] md:text-[16rem]">
                {remaining ?? 0}
              </div>
              <div className="mt-6 rounded-md border border-white/20 bg-[#005180]/30 px-4 py-2 text-sm text-white/90">
                Санал өгсөн: {attendance?.votesCastCount ?? 0}
              </div>
            </>
          )}
        </div>
      ) : resultsForUi ? (
        <div className="flex min-h-screen flex-col px-6 pb-6 pt-24 md:px-10 md:pt-28">
          {demoMode && !results ? (
            <div className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-white/75">
              Дэмо горим — зөвхөн дизайн (?demo=1)
            </div>
          ) : null}

          <div className="mx-auto grid min-h-0 w-full max-w-[min(100%,96rem)] flex-1 grid-cols-2 gap-6 md:gap-12">
            <div
              className={[
                "flex min-h-0 flex-col gap-1",
                resultsForUi.anonymous
                  ? "min-h-[70vh] items-center justify-center text-center"
                  : "md:min-h-0 md:flex-1",
              ].join(" ")}
            >
              {resultsForUi.anonymous ? (
                <div className="flex w-full shrink-0 flex-col items-center text-center">
                  <div className="text-5xl font-bold uppercase md:text-7xl lg:text-8xl">Зөвшөөрсөн</div>
                  <div className="mt-1 text-2xl font-semibold md:text-4xl lg:text-5xl">
                    {resultsForUi.approveCount}/{attendance?.eligibleMemberCount ?? resultsForUi.totalVotes}{" "}
                    {resultsForUi.approvePercent.toFixed(1)}%
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-0 sm:px-3 md:px-8 lg:px-12 xl:px-16 2xl:px-24">
                  <div className="mx-auto w-full max-w-[26rem] shrink-0">
                    <div className="text-start leading-tight">
                      <div className="text-4xl font-bold uppercase md:text-6xl">Зөвшөөрсөн</div>
                      <div className="mt-1 text-lg font-semibold leading-tight md:text-2xl">
                        {resultStatsForScreen!.approveCount}/
                        {attendance?.eligibleMemberCount ?? resultStatsForScreen!.totalVotes}{" "}
                        {resultStatsForScreen!.approvePercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="admin-credits-clip box-border mt-1 min-h-[min(52vh,520px)] w-full flex-1 overflow-hidden text-start md:h-[calc(100vh-15rem)] md:max-h-[calc(100vh-15rem)] md:flex-none">
                    <div
                      className="screen-credits-track pr-1"
                      style={{ animationDuration: `${creditsDurationSec}s`, animationIterationCount: "infinite" }}
                    >
                        {approveDisplay.length === 0 ? (
                          <div className="pt-1 text-3xl text-white/80 md:text-4xl">—</div>
                        ) : (
                          approveDisplay.map((v) => (
                            <div key={v.memberId} className="mb-3 text-2xl font-semibold md:text-4xl">
                              {v.fullName}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                </div>
              )}
            </div>
            <div
              className={[
                "flex min-h-0 flex-col gap-1",
                resultsForUi.anonymous
                  ? "min-h-[70vh] items-center justify-center text-center"
                  : "md:min-h-0 md:flex-1",
              ].join(" ")}
            >
              {resultsForUi.anonymous ? (
                <div className="flex w-full shrink-0 flex-col items-center text-center">
                  <div className="text-5xl font-bold uppercase text-[#fde047] md:text-7xl lg:text-8xl">Татгалзсан</div>
                  <div className="mt-1 text-2xl font-semibold text-[#fde047] md:text-4xl lg:text-5xl">
                    {resultsForUi.denyCount}/{attendance?.eligibleMemberCount ?? resultsForUi.totalVotes}{" "}
                    {resultsForUi.denyPercent.toFixed(1)}%
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-0 sm:px-3 md:px-8 lg:px-12 xl:px-16 2xl:px-24">
                  <div className="mx-auto w-full max-w-[26rem] shrink-0">
                    <div className="text-start leading-tight">
                      <div className="text-4xl font-bold uppercase text-[#fde047] md:text-6xl">Татгалзсан</div>
                      <div className="mt-1 text-lg font-semibold leading-tight text-[#fde047] md:text-2xl">
                        {resultStatsForScreen!.denyCount}/
                        {attendance?.eligibleMemberCount ?? resultStatsForScreen!.totalVotes}{" "}
                        {resultStatsForScreen!.denyPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="admin-credits-clip box-border mt-1 min-h-[min(52vh,520px)] w-full flex-1 overflow-hidden text-start md:h-[calc(100vh-15rem)] md:max-h-[calc(100vh-15rem)] md:flex-none">
                    <div
                      className="screen-credits-track pr-1"
                      style={{ animationDuration: `${creditsDurationSec}s`, animationIterationCount: "infinite" }}
                    >
                        {denyDisplay.length === 0 ? (
                          <div className="pt-1 text-3xl text-[#fde047] md:text-4xl">—</div>
                        ) : (
                          denyDisplay.map((v) => (
                            <div key={v.memberId} className="mb-3 text-2xl font-semibold text-[#fde047] md:text-4xl">
                              {v.fullName}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <p className="text-3xl font-semibold md:text-5xl">Санал хаагдсан</p>
        </div>
      )}
    </div>
  );
}
