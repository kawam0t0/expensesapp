import { NextRequest, NextResponse } from "next/server";
import { deleteDraftByFolder } from "@/lib/supabase-db";

export async function DELETE(req: NextRequest) {
  try {
    const folderName = req.nextUrl.searchParams.get("folder_name");
    if (!folderName) {
      return NextResponse.json({ error: "folder_name が必要です" }, { status: 400 });
    }
    await deleteDraftByFolder(folderName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[drafts/delete]", error);
    return NextResponse.json({ error: "下書き削除に失敗しました" }, { status: 500 });
  }
}
