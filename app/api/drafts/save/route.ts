import { NextRequest, NextResponse } from "next/server";
import { saveDraft } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { folder_name, amounts, uploaded_urls } = await req.json();
    if (!folder_name || !amounts) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }
    await saveDraft(folder_name, amounts, uploaded_urls ?? {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[drafts/save]", error);
    return NextResponse.json({ error: "下書き保存に失敗しました" }, { status: 500 });
  }
}
