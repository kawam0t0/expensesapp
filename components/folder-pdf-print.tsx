"use client";

import { useRef } from "react";
import { Download } from "lucide-react";
import type { ExpenseRow } from "@/lib/sheets";

interface FolderPdfPrintProps {
  folderName: string;
  items: ExpenseRow[];
}

export function FolderPdfPrint({ folderName, items }: FolderPdfPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${folderName} 経費明細</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #111; padding: 32px 40px; font-size: 11px; line-height: 1.6; }
    h1 { font-size: 18px; font-weight: 900; letter-spacing: 0.05em; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #555; margin-bottom: 20px; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #1a3a5c; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; letter-spacing: 0.08em; }
    td { padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 11px; }
    tr:nth-child(even) td { background: #f5f7fa; }
    .amount { text-align: right; font-weight: 700; }
    .amount-sub { text-align: right; font-size: 9px; color: #777; font-weight: 400; }
    .total-row td { font-weight: 900; font-size: 13px; border-top: 2px solid #1a3a5c; border-bottom: none; color: #111; background: #eef2f7; }
    .section-title { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; margin: 18px 0 6px; color: #1a3a5c; text-transform: uppercase; }
    .tax-exempt { display: inline-block; margin-left: 6px; font-size: 9px; font-weight: 700; color: #c0392b; border: 1px solid #c0392b; padding: 0px 4px; border-radius: 2px; vertical-align: middle; }
    .detail-table th { background: #2d5f8a; }
    @media print { body { padding: 16px 20px; } }
  </style>
</head>
<body>
  ${el.innerHTML}
  <script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 500); window.onafterprint = function(){ window.close(); }; }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  const printDate = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  // 売上・運営費用を分離
  const salesItems = items.filter((e) => e.category === "売上");
  const expenseItems = items.filter((e) => e.category !== "売上");
  const salesTotal = salesItems.reduce((s, e) => s + Number(e.amount), 0);
  const expenseTotal = expenseItems.reduce((s, e) => s + Number(e.amount), 0);
  const transferAmount = salesTotal - expenseTotal;

  return (
    <>
      {/* 印刷ボタン */}
      <button
        type="button"
        onClick={handlePrint}
        className="flex items-center gap-1 border border-border text-muted-foreground px-2.5 py-1 text-[10px] tracking-widest uppercase font-bold hover:border-primary hover:text-primary transition-colors"
        title="PDFダウンロード"
      >
        <Download className="w-3 h-3" />
        PDF
      </button>

      {/* 印刷用HTML（画面上は非表示） */}
      <div ref={printRef} className="hidden">
        <h1>{folderName} 経費明細</h1>
        <p className="meta">出力日: {printDate}</p>

        {/* 売上 */}
        {salesItems.length > 0 && (
          <>
            <p className="section-title">売上</p>
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>品目</th>
                  <th style={{ textAlign: "right" }}>金額（税込）</th>
                  <th style={{ textAlign: "right" }}>金額（税抜）</th>
                </tr>
              </thead>
              <tbody>
                {salesItems.map((e) => {
                  const inc = Number(e.amount);
                  const exc = Math.floor(inc / 1.1);
                  return (
                    <tr key={e.id}>
                      <td>{e.datetime}</td>
                      <td>{e.item_name}</td>
                      <td className="amount">¥{inc.toLocaleString("ja-JP")}</td>
                      <td className="amount">¥{exc.toLocaleString("ja-JP")}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td colSpan={2}>売上 小計</td>
                  <td className="amount">¥{salesTotal.toLocaleString("ja-JP")}</td>
                  <td className="amount">¥{Math.floor(salesTotal / 1.1).toLocaleString("ja-JP")}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* 運営費用 */}
        {expenseItems.length > 0 && (
          <>
            <p className="section-title">運営費用</p>
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>品目</th>
                  <th style={{ textAlign: "right" }}>金額（税込）</th>
                  <th style={{ textAlign: "right" }}>金額（税抜）</th>
                </tr>
              </thead>
              <tbody>
                {expenseItems.map((e) => {
                  const inc = Number(e.amount);
                  // 非課税項目：人件費・保険費用
                  const isTaxExempt =
                    e.item_name.startsWith("人件費") ||
                    e.item_name === "保険費用" ||
                    e.item_name === "福利厚生費";
                  return (
                    <tr key={e.id}>
                      <td>{e.datetime}</td>
                      <td>
                        {e.item_name}
                        {isTaxExempt && (
                          <span className="tax-exempt">非課税</span>
                        )}
                      </td>
                      <td className="amount">¥{inc.toLocaleString("ja-JP")}</td>
                      <td className="amount">{isTaxExempt ? "—" : `¥${Math.floor(inc / 1.1).toLocaleString("ja-JP")}`}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td colSpan={2}>運営費用 小計</td>
                  <td className="amount">¥{expenseTotal.toLocaleString("ja-JP")}</td>
                  <td className="amount">¥{Math.floor(expenseTotal / 1.1).toLocaleString("ja-JP")}</td>
                </tr>
                <tr style={{ background: "#1a3a5c", borderTop: "2px solid #0f2a42" }}>
                  <td colSpan={2} style={{ color: "#fff", fontWeight: 900, fontSize: "13px", padding: "10px", letterSpacing: "0.1em" }}>
                    {transferAmount >= 0 ? "振込金額" : "請求金額"}
                  </td>
                  <td style={{ color: "#fff", fontWeight: 900, fontSize: "13px", padding: "10px", textAlign: "right" }}>
                    ¥{Math.abs(transferAmount).toLocaleString("ja-JP")}
                    <div style={{ fontSize: "9px", fontWeight: 400, color: "#cdd9e5", marginTop: "1px" }}>税込</div>
                  </td>
                  <td style={{ color: "#fff", fontWeight: 900, fontSize: "13px", padding: "10px", textAlign: "right" }}>
                    ¥{Math.abs(Math.floor(transferAmount / 1.1)).toLocaleString("ja-JP")}
                    <div style={{ fontSize: "9px", fontWeight: 400, color: "#cdd9e5", marginTop: "1px" }}>税抜</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
