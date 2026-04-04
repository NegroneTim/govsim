import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string; memberId: string }> }
) {
  const { code, memberId } = await context.params;
  const sessionCode = String(code ?? "");
  const adminKey = req.headers.get("X-Admin-Key") ?? "";
  const memberIdStr = String(memberId ?? "");

  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
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
  await supabase
    .from("members")
    .update({ kicked_at: now.toISOString() })
    .eq("id", memberIdStr)
    .eq("session_code", sessionCode);

  return NextResponse.json({ ok: true });
}
