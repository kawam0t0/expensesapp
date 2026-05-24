import { NextResponse } from "next/server";
import { listDrafts } from "@/lib/supabase-db";

export async function GET() {
  try {
    const drafts = await listDrafts();
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("[drafts/list]", error);
    return NextResponse.json({ error: "下書き一覧の取得に失敗しました" }, { status: 500 });
  }
}
