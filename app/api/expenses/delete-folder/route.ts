import { NextRequest, NextResponse } from "next/server";
import { deleteFolder, deleteDraftByFolder } from "@/lib/supabase-db";

export async function DELETE(req: NextRequest) {
  try {
    const { folder_name } = await req.json();
    if (!folder_name) return NextResponse.json({ error: "folder_name is required" }, { status: 400 });
    // 経費行を全削除
    await deleteFolder(folder_name);
    // 下書きも合わせて削除
    await deleteDraftByFolder(folder_name).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
