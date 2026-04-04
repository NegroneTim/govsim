import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const sessionCode = String(code ?? "");
  if (!/^\d{6}$/.test(sessionCode)) {
    return NextResponse.json({ error: "Invalid session code." }, { status: 400 });
  }

  const adminKey = req.headers.get("X-Admin-Key") ?? "";
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

  // Foreign Key-үүд CASCADE тохиргоотой бол зөвхөн session устгахад хангалттай.
  await supabase.from("sessions").delete().eq("code", sessionCode);

  return NextResponse.json({ ok: true });
}
