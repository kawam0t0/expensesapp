import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { folder_name, item_name, url } = await req.json();
    if (!folder_name || !item_name || !url) {
      return NextResponse.json({ error: "folder_name, item_name, url が必要です" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 現在の下書きを取得
    const { data: existing, error: fetchError } = await supabase
      .from("drafts")
      .select("files_json")
      .eq("folder_name", folder_name)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "下書きが見つかりません" }, { status: 404 });
    }

    const filesJson: Record<string, string> = existing.files_json ?? {};
    const currentUrls = filesJson[item_name] ? filesJson[item_name].split("\n").filter(Boolean) : [];

    // 対象URLを除外
    const updatedUrls = currentUrls.filter((u) => u !== url);

    const newFilesJson = { ...filesJson };
    if (updatedUrls.length === 0) {
      delete newFilesJson[item_name];
    } else {
      newFilesJson[item_name] = updatedUrls.join("\n");
    }

    const { error: updateError } = await supabase
      .from("drafts")
      .update({ files_json: newFilesJson, updated_at: new Date().toISOString() })
      .eq("folder_name", folder_name);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ok: true, remaining: updatedUrls });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
