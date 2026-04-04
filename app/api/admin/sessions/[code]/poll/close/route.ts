import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  const adminKey = req.headers.get("X-Admin-Key") ?? "";

  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Системийн тохиргоо (Supabase) хийгдээгүй байна." }, { status: 500 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("admin_key")
    .eq("code", sessionCode)
    .maybeSingle();

  if (!session || session.admin_key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const { data: poll } = await supabase
    .from("polls")
    .update({ 
      status: "closed", 
      closed_at: now.toISOString(), 
      ends_at: now.toISOString() 
    })
    .eq("session_code", sessionCode)
    .eq("status", "open")
    .select()
    .maybeSingle();

  if (!poll) {
    return NextResponse.json({ error: "No open poll to close." }, { status: 400 });
  }

  const { data: eligibleMembers } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("session_code", sessionCode)
    .is("kicked_at", null);

  const { data: existingVotes } = await supabase
    .from("votes")
    .select("member_id")
    .eq("poll_id", poll.id);

  const votedSet = new Set(existingVotes?.map((v:any) => v.member_id));
  const missing = eligibleMembers?.filter((m:any) => !votedSet.has(m.id)) || [];
  const anonymous = poll.anonymous === true;
  const snapshotFor = (fullName: string) => (anonymous ? "Нууц" : fullName);

  if (missing.length > 0) {
    const autoDenyVotes = missing.map((m:any) => ({
      poll_id: poll.id,
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

  return NextResponse.json({ pollId: poll.id });
}
