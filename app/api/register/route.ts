import { NextRequest, NextResponse } from "next/server";
import { appendExpense } from "@/lib/supabase-db";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folder_name, category, item_name, amount, datafile } = body;

    if (!folder_name || !category || !item_name || amount === undefined) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    await appendExpense({
      folder_name,
      category,
      item_name,
      amount: isNaN(Number(amount)) ? amount : Number(amount),
      datafile: datafile ?? "",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[register] error:", error);
    return NextResponse.json(
      { error: "経費の登録に失敗しました" },
      { status: 500 }
    );
  }
}
