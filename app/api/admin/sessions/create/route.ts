import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

function generateSessionCode() {
  const num = crypto.randomInt(0, 1_000_000);
  return String(num).padStart(6, "0");
}

function generateAdminKey() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Системийн тохиргоо (Supabase) хийгдээгүй байна. Төслийн .env файлыг шалгана уу." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const rawPlanned = body?.plannedAttendeeCount;
  const plannedAttendeeCount =
    typeof rawPlanned === "number"
      ? Math.max(0, Math.floor(rawPlanned))
      : typeof rawPlanned === "string" && rawPlanned.trim() !== ""
        ? Math.max(0, parseInt(rawPlanned, 10) || 0)
        : 0;

  for (let i = 0; i < 8; i++) {
    const code = generateSessionCode();
    const adminKey = generateAdminKey();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        code,
        admin_key: adminKey,
        planned_attendee_count: plannedAttendeeCount,
      })
      .select()
      .single();

    if (error) {
      // PostgreSQL error code '23505' is a unique_violation. 
      // If this happens, we continue the loop to try a new random code.
      if (error.code === '23505') {
        continue;
      }

      // For any other error (schema mismatch, connection, etc.), return it immediately.
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 500 }
      );
    }

    return NextResponse.json({
      code: data.code,
      adminKey: data.admin_key,
      plannedAttendeeCount: data.planned_attendee_count ?? 0,
    });
  }

  return NextResponse.json({ error: "Failed to create session. Try again." }, { status: 500 });
}
