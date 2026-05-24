"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Database, ArrowRight } from "lucide-react";

export default function MigratePage() {
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ expenseCount: number; draftCount: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleMigrate() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const parsed = JSON.parse(jsonText);
      const expenses = parsed.expenses ?? parsed;
      const drafts = parsed.drafts ?? [];

      const res = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses, drafts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "移行に失敗しました");
      setResult(data);
      setStatus("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "エラーが発生しました");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-foreground">
            <Database className="w-6 h-6 text-muted-foreground" />
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Database className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-foreground">Google Sheets → Supabase 移行</h1>
          <p className="text-sm text-muted-foreground">
            Google Sheets からエクスポートした経費データを貼り付けてSupabaseに移行します
          </p>
        </div>

        <div className="border border-border bg-card p-4 space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">移行手順</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Google Sheetsの <code className="bg-secondary px-1">history</code> シートのデータをJSON形式で用意する</li>
            <li>以下の形式で貼り付ける</li>
            <li>「移行を実行」ボタンを押す</li>
          </ol>
          <pre className="bg-secondary p-3 text-xs overflow-auto rounded">{`{
  "expenses": [
    {
      "id": "EXP-xxx",
      "datetime": "2026-4-1 12:00:00",
      "folder_name": "2026年4月",
      "category": "運営費用",
      "item_name": "水道料金",
      "amount": 5000,
      "datafile": ""
    }
  ],
  "drafts": []
}`}</pre>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground tracking-wider">JSONデータ</label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="JSONを貼り付けてください..."
            className="w-full h-48 bg-input border border-border text-foreground text-sm p-3 font-mono focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <button
          onClick={handleMigrate}
          disabled={!jsonText.trim() || status === "loading"}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 text-sm font-medium tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="w-4 h-4" />
          {status === "loading" ? "移行中..." : "移行を実行"}
        </button>

        {status === "success" && result && (
          <div className="flex items-start gap-3 border border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">移行完了</p>
              <p className="text-sm text-muted-foreground">
                経費データ: {result.expenseCount}件 / 下書き: {result.draftCount}件 を移行しました
              </p>
              <a href="/" className="text-sm text-primary hover:underline">
                アプリに戻る →
              </a>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/5 p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
