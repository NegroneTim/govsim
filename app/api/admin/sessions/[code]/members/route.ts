import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
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

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("admin_key")
    .eq("code", sessionCode)
    .single();

  if (sessionError || !session || session.admin_key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("*")
    .eq("session_code", sessionCode)
    .order("joined_at", { ascending: true });

  if (membersError) {
    console.error("Supabase error fetching members:", membersError);
    return NextResponse.json({ error: "Failed to fetch members." }, { status: 500 });
  }

  return NextResponse.json({
    members: (members || []).map((m: any) => ({
      id: m.id,
      fullName: m.full_name,
      joinedAt: m.joined_at,
      kickedAt: m.kicked_at,
    })),
  });
}
