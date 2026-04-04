import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: Request,
  props: { params: Promise<{ code: string }> }
) {
  try {
    const params = await props.params;
    const code = params.code;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!supabaseAdmin) {
      console.error("Raise Hand: supabaseAdmin is not initialized. Check your environment variables.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // Гишүүнийг токен болон хуралдааны кодоор хайх
    const { data: member, error: memberError } = await supabaseAdmin!
      .from("members")
      .select("id, hand_raised_at, kicked_at")
      .eq("token", token)
      .eq("session_code", code)
      .maybeSingle();

    if (memberError) {
      console.error("Raise hand DB error:", memberError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (member.kicked_at) return NextResponse.json({ error: "Kicked" }, { status: 403 });

    if (!member.id) {
      console.error("Raise Hand: Member found but ID is missing", member);
      return NextResponse.json({ error: "Member ID missing" }, { status: 500 });
    }

    // Гарын төлөвийг өөрчлөх (Toggle)
    const newHandStatus = member.hand_raised_at ? null : new Date().toISOString();

    const { data: updatedMember, error: updateError } = await supabaseAdmin!
      .from("members")
      .update({ hand_raised_at: newHandStatus })
      .eq("id", member.id)
      .eq("session_code", code) // Нэмэлт аюулгүй байдал
      .select("hand_raised_at")
      .single();

    if (updateError) {
      console.error("Raise Hand Update Error:", updateError);
      return NextResponse.json({ error: "Update failed", details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ handRaisedAt: updatedMember.hand_raised_at });
  } catch (error) {
    console.error("Raise hand error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}