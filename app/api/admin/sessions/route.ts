// app/api/admin/sessions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // 1. JSON body-оос code-оо салгаж авах
  const { code } = await req.json(); 
  const adminKey = req.headers.get("X-Admin-Key");

  // Админ түлхүүр шалгах...
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin!
    .from("members")
    .update({ hand_raised_at: null })
    .eq("session_code", code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}