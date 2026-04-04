import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

function isValidCode(code: string) {
  return /^\d{6}$/.test(code);
}

const MEMBER_NAME_PATTERN = /^[А-ЯӨҮЁ][а-яөүё]+(?:-[А-ЯӨҮЁ][а-яөүё]+)*\.[А-ЯӨҮЁ]$/u;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const code = String(body.code ?? "");
    const fullName = String(body.fullName ?? "").trim();

    if (!isValidCode(code)) {
      return NextResponse.json({ error: "Session code must be 6 digits." }, { status: 400 });
    }
    if (!MEMBER_NAME_PATTERN.test(fullName)) {
      return NextResponse.json({ error: "Нэрийг Батмөнх.А эсвэл Энх-Ариун.О хэлбэрээр оруулна уу." }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (sessionError) {
      console.error("Supabase session lookup error:", sessionError);
      return NextResponse.json(
        { error: "Failed to find session.", details: sessionError.message },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const token = crypto.randomBytes(24).toString("hex");

    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({
        session_code: code,
        full_name: fullName,
        token,
      })
      .select()
      .single();

    if (memberError) {
      console.error("Supabase member creation error:", memberError);
      return NextResponse.json({ error: "Failed to create member.", details: memberError.message }, { status: 500 });
    }

    return NextResponse.json({
      memberId: member.id,
      token,
    });
  } catch (error) {
    console.error("Unexpected error in join session route:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}   
