import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { expenses, drafts } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let expenseCount = 0;
    let draftCount = 0;

    // 経費データを移行
    if (Array.isArray(expenses) && expenses.length > 0) {
      const rows = expenses.map((e: {
        id?: string; datetime?: string; folder_name: string;
        category: string; item_name: string; amount: number | string; datafile?: string;
      }) => ({
        id: e.id || `EXP-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        datetime: e.datetime ? new Date(e.datetime.replace(/-/g, "/")).toISOString() : new Date().toISOString(),
        folder_name: e.folder_name,
        category: e.category,
        item_name: e.item_name,
        amount: isNaN(Number(e.amount)) ? 0 : Number(e.amount),
        datafile: e.datafile ?? "",
      }));

      const { error } = await supabase
        .from("expenses")
        .upsert(rows, { onConflict: "id" });

      if (error) throw new Error(`経費移行エラー: ${error.message}`);
      expenseCount = rows.length;
    }

    // 下書きデータを移行
    if (Array.isArray(drafts) && drafts.length > 0) {
      for (const d of drafts) {
        const { error } = await supabase.from("drafts").upsert(
          {
            folder_name: d.folder_name,
            amounts_json: JSON.parse(d.amounts_json || "{}"),
            files_json: JSON.parse(d.files_json || "{}"),
            saved_at: d.saved_at ? new Date(d.saved_at.replace(/-/g, "/")).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "folder_name" }
        );
        if (error) throw new Error(`下書き移行エラー: ${error.message}`);
        draftCount++;
      }
    }

    return NextResponse.json({ success: true, expenseCount, draftCount });
  } catch (error) {
    console.error("[migrate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "移行に失敗しました" },
      { status: 500 }
    );
  }
}
