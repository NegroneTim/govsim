import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const COUNTDOWN_SETUP_LEAD_MS = 3500;

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

  const body = await req.json().catch(() => null);

  const rawDur = body?.durationSeconds;
  let durationSec = 10;
  if (typeof rawDur === "number" && Number.isFinite(rawDur)) {
    durationSec = Math.round(rawDur);
  } else if (typeof rawDur === "string" && rawDur.trim() !== "") {
    const n = parseInt(rawDur, 10);
    if (!Number.isNaN(n)) durationSec = n;
  }
  durationSec = Math.min(600, Math.max(5, durationSec));

  const anonymous = body?.anonymous === true;

  const { data: session } = await supabase
    .from("sessions")
    .select("admin_key")
    .eq("code", sessionCode)
    .maybeSingle();

  if (!session || session.admin_key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + durationSec * 1000 + COUNTDOWN_SETUP_LEAD_MS);

  // Ensure only one poll is open at a time.
  await supabase
    .from("polls")
    .update({ 
      status: "closed", 
      closed_at: now.toISOString(), 
      ends_at: now.toISOString() 
    })
    .eq("session_code", sessionCode)
    .eq("status", "open");

  const { data: poll } = await supabase
    .from("polls")
    .insert({
    session_code: sessionCode,
    problem: "Санал хураалт",
    started_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_seconds: durationSec,
    status: "open",
    anonymous,
  })
  .select()
  .single();

  return NextResponse.json({ pollId: poll?.id, durationSeconds: durationSec });
}
