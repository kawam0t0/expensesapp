import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive } from "@/lib/drive";

/**
 * Supabase Storage上のファイルURLを受け取り、Google Driveに転送する
 * POST body: { urls: string[], item_name: string, folder_name: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { urls, item_name, folder_name } = await req.json() as {
      urls: string[];
      item_name: string;
      folder_name: string;
    };

    if (!urls || urls.length === 0 || !item_name || !folder_name) {
      return NextResponse.json({ error: "urls, item_name, folder_name が必要です" }, { status: 400 });
    }

    const driveUrls: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const storageUrl = urls[i];
      try {
        // Supabase StorageからファイルをDL
        const fetchRes = await fetch(storageUrl);
        if (!fetchRes.ok) throw new Error(`fetch failed: ${fetchRes.status}`);
        const contentType = fetchRes.headers.get("content-type") ?? "application/octet-stream";
        const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
        const buffer = Buffer.from(await fetchRes.arrayBuffer());

        // ファイル名: フォルダー名_項目名_連番.拡張子
        const suffix = urls.length > 1 ? `_${i + 1}` : "";
        const fileName = `${folder_name}_${item_name}${suffix}.${ext}`;

        // Google Driveにアップロード
        const driveUrl = await uploadToDrive(buffer, contentType, fileName, folder_name);
        driveUrls.push(driveUrl);
      } catch (err) {
        console.error(`[transfer-to-drive] failed for ${storageUrl}:`, err);
        // 失敗したURLはSupabaseのURLをそのまま使う
        driveUrls.push(storageUrl);
      }
    }

    return NextResponse.json({ urls: driveUrls });
  } catch (error) {
    console.error("[transfer-to-drive] error:", error);
    return NextResponse.json({ error: "転送に失敗しました" }, { status: 500 });
  }
}
