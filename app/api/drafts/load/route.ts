import { NextRequest, NextResponse } from "next/server";
import { loadDraft } from "@/lib/supabase-db";

export async function GET(req: NextRequest) {
  try {
    const folderName = req.nextUrl.searchParams.get("folder_name");
    if (!folderName) {
      return NextResponse.json({ error: "folder_name が必要です" }, { status: 400 });
    }
    const draft = await loadDraft(folderName);
    return NextResponse.json({ draft });
  } catch (error) {
    console.error("[drafts/load]", error);
    return NextResponse.json({ error: "下書き読み込みに失敗しました" }, { status: 500 });
  }
}
