import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPollDurationSeconds } from "@/lib/pollDuration";
import { MemberDoc, PollDoc, SessionDoc, VoteDoc } from "@/lib/models";

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

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", sessionCode)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const { count: eligibleMemberCount } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("session_code", sessionCode)
    .is("kicked_at", null);

  const plannedAttendeeCount = Math.max(0, Number(session.planned_attendee_count ?? 0));

  let { data: poll } = await supabase
    .from("polls")
    .select("*")
    .eq("session_code", sessionCode)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();

  if (
    poll &&
    poll.status === "open" &&
    now.getTime() >= new Date(poll.ends_at).getTime() + AUTO_DENY_GRACE_MS
  ) {
    // 1. Poll-ыг хаах
    const { data: updatedPoll } = await supabase
      .from("polls")
      .update({ status: "closed", closed_at: now.toISOString(), ends_at: now.toISOString() })
      .eq("id", poll.id)
      .select()
      .single();
    
    if (updatedPoll) poll = updatedPoll;

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

    const votedSet = new Set(existingVotes?.map((v:any) => v.member_id));
    const missing = eligibleMembers?.filter((m:any) => !votedSet.has(m.id)) || [];

    const anon = poll.anonymous === true;
    const snapshotFor = (fullName: string) => (anon ? "Нууц" : fullName);

    if (missing.length > 0) {
      const autoDenyVotes = missing.map((m:any) => ({
        poll_id: poll!.id,
        session_code: sessionCode,
        member_id: m.id,
        full_name_snapshot: snapshotFor(m.full_name),
        choice: "deny",
        voted_at: now.toISOString(),
      }));

      await supabase.from("votes").upsert(autoDenyVotes, {
        onConflict: "poll_id, member_id",
      });
    }
  }

  if (!poll) {
    return NextResponse.json({
      sessionCode: sessionCode,
      nowISO: now.toISOString(),
      poll: null,
      results: null,
      attendance: {
        eligibleMemberCount: eligibleMemberCount || 0,
        plannedAttendeeCount,
        votesCastCount: 0,
        voteParticipationPercent: 0,
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

  const { count: votesCastCount } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("poll_id", poll.id);

  const attendance = {
    eligibleMemberCount: eligibleMemberCount || 0,
    plannedAttendeeCount,
    votesCastCount: votesCastCount || 0,
    voteParticipationPercent:
      (eligibleMemberCount || 0) > 0 ? Math.round(((votesCastCount || 0) / eligibleMemberCount!) * 1000) / 10 : 0,
  };

  if (isActive) {
    return NextResponse.json({
      sessionCode: sessionCode,
      nowISO: now.toISOString(),
      poll: pollPayload,
      results: null,
      attendance,
    });
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("*")
    .eq("poll_id", poll.id);

  const totalVotes = votes?.length || 0;
  const approveCount = votes?.filter((v:any) => v.choice === "approve").length || 0;
  const denyCount = votes?.filter((v:any) => v.choice === "deny").length || 0;

  const approvePercent = totalVotes ? (approveCount / totalVotes) * 100 : 0;
  const denyPercent = totalVotes ? (denyCount / totalVotes) * 100 : 0;

  const isAnonymous = poll.anonymous === true;
  const approve = isAnonymous ? [] : (votes || [])
    .filter((v:any) => v.choice === "approve")
    .map((v:any) => ({ memberId: v.member_id, fullName: v.full_name_snapshot }));

  const deny = isAnonymous ? [] : (votes || [])
    .filter((v:any) => v.choice === "deny")
    .map((v:any) => ({ memberId: v.member_id, fullName: v.full_name_snapshot }));

  return NextResponse.json({
    sessionCode: sessionCode,
    nowISO: now.toISOString(),
    poll: pollPayload,
    results: {
      totalVotes,
      approveCount,
      denyCount,
      approvePercent,
      denyPercent,
      approve,
      deny,
      anonymous: isAnonymous,
    },
    attendance: {
      eligibleMemberCount: eligibleMemberCount || 0,
      plannedAttendeeCount,
      votesCastCount: totalVotes,
      voteParticipationPercent:
        (eligibleMemberCount || 0) > 0 ? Math.round((totalVotes / eligibleMemberCount!) * 1000) / 10 : 0,
    },
  });
}
