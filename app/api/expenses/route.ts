import { NextRequest, NextResponse } from "next/server";
import { getExpenses } from "@/lib/sheets";

export async function GET() {
  try {
    const expenses = await getExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("[v0] GET /api/expenses error:", error);
    return NextResponse.json(
      { error: "経費データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
