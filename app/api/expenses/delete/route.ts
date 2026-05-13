import { NextRequest, NextResponse } from "next/server";
import { deleteExpense } from "@/lib/sheets";

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] DELETE /api/expenses/delete error:", error);
    return NextResponse.json(
      { error: "削除に失敗しました" },
      { status: 500 }
    );
  }
}
