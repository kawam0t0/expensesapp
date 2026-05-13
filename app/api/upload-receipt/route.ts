import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive } from "@/lib/drive";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const customFileName = (formData.get("file_name") as string) || null;
    const folderName = (formData.get("folder_name") as string) || undefined;

    console.log("[upload-receipt] file_name:", customFileName, "folder_name:", folderName);

    if (!file) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = customFileName ?? `receipt_${Date.now()}.${ext}`;

    const url = await uploadToDrive(buffer, file.type, fileName, folderName);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[upload-receipt] error:", error);
    return NextResponse.json(
      { error: "アップロードに失敗しました" },
      { status: 500 }
    );
  }
}

