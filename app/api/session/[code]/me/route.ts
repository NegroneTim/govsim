import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPollDurationSeconds } from "@/lib/pollDuration";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  if (!isValidCode(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  // 1. Member шалгах
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("session_code", sessionCode)
    .eq("token", token)
    .maybeSingle();

  if (memberError || !member || member.kicked_at) {
    return NextResponse.json({ error: "Member not found or kicked." }, { status: 401 });
  }

  // 2. Session-ийн is_speech_mode утгыг авах
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("is_speech_mode")
    .eq("code", sessionCode)
    .maybeSingle();

  if (sessionError) {
    console.error("Session fetch error:", sessionError);
  }

  const isSpeechMode = session?.is_speech_mode ?? false;

  const now = new Date();
  // 3. Хамгийн сүүлийн poll хайх
  const { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("session_code", sessionCode)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!poll) {
    return NextResponse.json({
      poll: null,
      myVote: null,
      member: { fullName: member.full_name },
      handRaisedAt: member.hand_raised_at ?? null,
      isSpeechMode,
    });
  }

  const durationSeconds = getPollDurationSeconds({
    durationSeconds: poll.duration_seconds,
    startedAt: new Date(poll.started_at),
    endsAt: new Date(poll.ends_at),
  });

  const isActive = poll.status === "open" && now.getTime() < new Date(poll.ends_at).getTime();
  const pollPayload = {
    id: poll.id,
    problem: poll.problem,
    startedAt: poll.started_at,
    endsAt: poll.ends_at,
    durationSeconds,
    isActive,
    status: poll.status,
  };

  // 4. Санал шалгах
  const { data: vote } = await supabase
    .from("votes")
    .select("choice")
    .eq("poll_id", poll.id)
    .eq("member_id", member.id)
    .maybeSingle();

  // 5. Хэрэв poll идэвхгүй бол үр дүнг тооцоолох
  let results = null;
  if (poll && !isActive && poll.status === "closed") {
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("choice")
      .eq("poll_id", poll.id);

    if (!votesError && votes) {
      const approveCount = votes.filter((v: any) => v.choice === "approve").length;
      const denyCount = votes.filter((v: any) => v.choice === "deny").length;
      const totalVotes = approveCount + denyCount;
      results = {
        totalVotes,
        approveCount,
        denyCount,
        approvePercent: totalVotes > 0 ? (approveCount / totalVotes) * 100 : 0,
        denyPercent: totalVotes > 0 ? (denyCount / totalVotes) * 100 : 0,
      };
    }
  }

  return NextResponse.json({
    poll: pollPayload,
    myVote: vote ? (vote.choice as "approve" | "deny") : null,
    member: { fullName: member.full_name },
    handRaisedAt: member.hand_raised_at ?? null,
    isSpeechMode,
    results,
  });
}