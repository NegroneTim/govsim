// app/api/admin/session/[code]/lower-all/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    const adminKey = request.headers.get("X-Admin-Key");
    if (!adminKey) {
      return NextResponse.json(
        { error: "Unauthorized: Missing admin key" },
        { status: 401 }
      );
    }
    
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("admin_key")
      .eq("code", code)
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    if (session.admin_key !== adminKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid admin key" },
        { status: 401 }
      );
    }
    
    // Энд hand_raised_at баганыг null болгох
    const { error: updateError } = await supabase
      .from("members")
      .update({ hand_raised_at: null })  // ✅ зөв баганын нэр
      .eq("session_code", code);
    
    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to lower hands" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lower all hands error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}