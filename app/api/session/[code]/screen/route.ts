import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPollDurationSeconds } from "@/lib/pollDuration";

const AUTO_DENY_GRACE_MS = 3000;

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Системийн тохиргоо (Supabase) хийгдээгүй байна." },
      { status: 500 }
    );
  }

  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  if (!isValidCode(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  // Cache-г алгасах header нэмэх
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", sessionCode)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // Идэвхтэй гишүүдийн тоо (kicked_at null)
  const { count: eligibleMemberCount, error: memberCountError } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("session_code", sessionCode)
    .is("kicked_at", null);

  if (memberCountError) {
    console.error("Member count error:", memberCountError);
  }

  const plannedAttendeeCount = Math.max(0, Number(session.planned_attendee_count ?? 0));

  let { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("session_code", sessionCode)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();

  // Auto-deny логикийг сайжруулах
  if (
    poll &&
    poll.status === "open" &&
    now.getTime() >= new Date(poll.ends_at).getTime() + AUTO_DENY_GRACE_MS
  ) {
    // 1. Poll-ыг хаах
    const { data: updatedPoll, error: closeError } = await supabase
      .from("polls")
      .update({ status: "closed", closed_at: now.toISOString() })
      .eq("id", poll.id)
      .select()
      .single();
    
    if (closeError) {
      console.error("Error closing poll:", closeError);
    } else if (updatedPoll) {
      poll = updatedPoll;
    }

    // 2. Санал өгөөгүй хүмүүсийг олох
    const { data: eligibleMembers } = await supabase
      .from("members")
      .select("id, full_name")
      .eq("session_code", sessionCode)
      .is("kicked_at", null);

    const { data: existingVotes } = await supabase
      .from("votes")
      .select("member_id")
      .eq("poll_id", poll!.id);

    const votedSet = new Set(existingVotes?.map((v: any) => v.member_id));
    const missing = eligibleMembers?.filter((m: any) => !votedSet.has(m.id)) || [];

    const anon = poll.anonymous === true;
    const snapshotFor = (fullName: string) => (anon ? "Нууц" : fullName);

    if (missing.length > 0) {
      const autoDenyVotes = missing.map((m: any) => ({
        poll_id: poll!.id,
        session_code: sessionCode,
        member_id: m.id,
        full_name_snapshot: snapshotFor(m.full_name),
        choice: "deny",
        voted_at: now.toISOString(),
      }));

      const { error: insertError } = await supabase.from("votes").insert(autoDenyVotes);
      if (insertError) {
        console.error("Error inserting auto-deny votes:", insertError);
      }
    }
  }

  if (!poll) {
    const votesCastCount = 0;
    const voteParticipationPercent = (eligibleMemberCount || 0) > 0 ? 0 : 0;

    return NextResponse.json({
      sessionCode: sessionCode,
      nowISO: now.toISOString(),
      isSpeechMode: !!session.is_speech_mode,
      poll: null,
      results: null,
      attendance: {
        eligibleMemberCount: eligibleMemberCount || 0,
        plannedAttendeeCount,
        votesCastCount,
        voteParticipationPercent,
      },
    });
  }

  const isActive = poll.status === "open" && now.getTime() < new Date(poll.ends_at).getTime();
  const durationSeconds = getPollDurationSeconds({
    durationSeconds: poll.duration_seconds,
    startedAt: new Date(poll.started_at),
    endsAt: new Date(poll.ends_at),
  });

  const pollPayload = {
    id: poll.id,
    problem: poll.problem,
    startedAt: poll.started_at,
    endsAt: poll.ends_at,
    durationSeconds,
    closedAt: poll.closed_at,
    status: poll.status as "open" | "closed",
    isActive,
    anonymous: poll.anonymous === true,
  };

  // Vote-ийн тоог зөв тооцоолох
  let votesCastCount = 0;
  let totalVotes = 0;
  let approveCount = 0;
  let denyCount = 0;
  let approvePercent = 0;
  let denyPercent = 0;
  let approve: Array<{ memberId: string; fullName: string }> = [];
  let deny: Array<{ memberId: string; fullName: string }> = [];

  if (!isActive) {
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("poll_id", poll.id);

    if (!votesError && votes) {
      totalVotes = votes.length;
      approveCount = votes.filter((v: any) => v.choice === "approve").length;
      denyCount = votes.filter((v: any) => v.choice === "deny").length;
      votesCastCount = totalVotes;

      approvePercent = totalVotes ? (approveCount / totalVotes) * 100 : 0;
      denyPercent = totalVotes ? (denyCount / totalVotes) * 100 : 0;

      const isAnonymous = poll.anonymous === true;
      if (!isAnonymous) {
        approve = votes
          .filter((v: any) => v.choice === "approve")
          .map((v: any) => ({ memberId: v.member_id, fullName: v.full_name_snapshot }));
        deny = votes
          .filter((v: any) => v.choice === "deny")
          .map((v: any) => ({ memberId: v.member_id, fullName: v.full_name_snapshot }));
      }
    }
  } else {
    // Active poll үед санал өгсөн хүмүүсийн тоо
    const { count, error: countError } = await supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("poll_id", poll.id);

    if (!countError) {
      votesCastCount = count || 0;
    }
  }

  const voteParticipationPercent = (eligibleMemberCount || 0) > 0 
    ? Math.round((votesCastCount / (eligibleMemberCount || 1)) * 1000) / 10 
    : 0;

  const attendance = {
    eligibleMemberCount: eligibleMemberCount || 0,
    plannedAttendeeCount,
    votesCastCount,
    voteParticipationPercent,
  };

  if (isActive) {
    return NextResponse.json({
      sessionCode: sessionCode,
      nowISO: now.toISOString(),
    isSpeechMode: !!session.is_speech_mode,
      poll: pollPayload,
      results: null,
      attendance,
    });
  }

  return NextResponse.json({
    sessionCode: sessionCode,
    nowISO: now.toISOString(),
    isSpeechMode: !!session.is_speech_mode,
    poll: pollPayload,
    results: {
      totalVotes,
      approveCount,
      denyCount,
      approvePercent,
      denyPercent,
      approve,
      deny,
      anonymous: poll.anonymous === true,
    },
    attendance,
  });
}