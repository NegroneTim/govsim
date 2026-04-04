import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function POST(
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

  const body = await req.json().catch(() => null);
  const choice = body?.choice;
  if (choice !== "approve" && choice !== "deny") {
    return NextResponse.json({ error: "Invalid vote choice." }, { status: 400 });
  }

  // 1. Member шалгах
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("session_code", sessionCode)
    .eq("token", token)
    .single();

  if (memberError || !member || member.kicked_at) {
    return NextResponse.json({ error: "Member not found or kicked." }, { status: 401 });
  }

  // 2. Идэвхтэй poll хайх
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("*")
    .eq("session_code", sessionCode)
    .eq("status", "open")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pollError || !poll) {
    return NextResponse.json({ error: "No active poll." }, { status: 400 });
  }

  // 3. Хугацаа шалгах
  const now = new Date();
  const endsAt = new Date(poll.ends_at);
  if (now >= endsAt) {
    return NextResponse.json({ error: "Poll is closed." }, { status: 400 });
  }

  const anonymous = poll.anonymous === true;
  const fullNameSnapshot = anonymous ? "Нууц" : member.full_name;

  // 4. Санал бүртгэх (Upsert)
  await supabase.from("votes").upsert({
    poll_id: poll.id,
    session_code: sessionCode,
    member_id: member.id,
    full_name_snapshot: fullNameSnapshot,
    choice,
    voted_at: now.toISOString(),
  }, { onConflict: "poll_id, member_id" });

  return NextResponse.json({ myVote: choice });
}
