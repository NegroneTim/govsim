import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const AUDIO_FILE = "audiomass-output_E♭_minor__bpm_107.mp3";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "app", AUDIO_FILE);
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Audio file not found." }, { status: 404 });
  }
}
