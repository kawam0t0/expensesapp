import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileName = formData.get("file_name") as string | null;
    const folderName = formData.get("folder_name") as string | null;

    if (!file || !fileName || !folderName) {
      return NextResponse.json({ error: "パラメータが不足しています" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Supabase Storageは日本語パスを受け付けないため
    // フォルダー名・ファイル名をASCII安全な文字列に変換する
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safeFileName = `${timestamp}_${rand}.${ext}`;
    // フォルダー名はBase64エンコードしてASCIIのみにする
    const safeFolderName = Buffer.from(folderName).toString("base64url");
    const storagePath = `${safeFolderName}/${safeFileName}`;

    const { error } = await supabase.storage
      .from("receipts")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("[upload-draft] storage error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 公開URLを取得
    const { data } = supabase.storage
      .from("receipts")
      .getPublicUrl(storagePath);

    console.log("[upload-draft] uploaded to Supabase Storage:", data.publicUrl);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("[upload-draft] error:", error);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
