import { NextRequest, NextResponse } from "next/server";
import { appendExpense } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // バルク登録: items 配列がある場合
    if (Array.isArray(body.items)) {
      const { folder_name, items } = body as {
        folder_name: string;
        items: { category: string; item_name: string; amount: number | string; datafile?: string }[];
      };

      if (!folder_name || items.length === 0) {
        return NextResponse.json(
          { error: "必須項目が不足しています" },
          { status: 400 }
        );
      }

      for (const item of items) {
        await appendExpense({
          folder_name,
          category: item.category,
          item_name: item.item_name,
          amount: isNaN(Number(item.amount)) ? item.amount : Number(item.amount),
          datafile: item.datafile ?? "",
        });
      }

      return NextResponse.json({ success: true, count: items.length });
    }

    // 単一登録（後方互換）
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
