import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const adminKey = req.headers.get("X-Admin-Key");
  
  if (!adminKey) {
    return NextResponse.json({ error: "Missing admin key." }, { status: 401 });
  }

  // Admin key шалгах
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("admin_key")
    .eq("code", code)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (session.admin_key !== adminKey) {
    return NextResponse.json({ error: "Invalid admin key." }, { status: 401 });
  }

  const body = await req.json();
  const { active } = body;

  // Speech mode шинэчлэх
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ is_speech_mode: active })
    .eq("code", code);

  if (updateError) {
    console.error("Update error:", updateError);
    return NextResponse.json({ error: "Failed to update speech mode." }, { status: 500 });
  }

  // Хэрэв speech mode унтарч байгаа бол бүх гишүүдийн гараа буулгах
  if (!active) {
    await supabase
      .from("members")
      .update({ hand_raised_at: null })
      .eq("session_code", code);
  }

  return NextResponse.json({ success: true, isSpeechMode: active });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("is_speech_mode")
    .eq("code", code)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ isSpeechMode: session.is_speech_mode });
}