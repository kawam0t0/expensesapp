"use client";

import { useState, useRef } from "react";
import { FileSpreadsheet, Loader2, AlertTriangle, Clock, Banknote } from "lucide-react";
import { toast } from "sonner";

// Drive にアップロードする際に保持するカラム（順序通り）
const KEEP_COLUMNS = [
  "氏名",
  "出勤日数（平日）（藤岡大塚店）",
  "出勤日数（所定休日）（藤岡大塚店）",
  "出勤日数（法定休日）（藤岡大塚店）",
  "遅刻回数（平日）（藤岡大塚店）",
  "遅刻回数（所定休日）（藤岡大塚店）",
  "遅刻回数（法定休日）（藤岡大塚店）",
  "早退回数（平日）（藤岡大塚店）",
  "早退回数（所定休日）（藤岡大塚店）",
  "早退回数（法定休日）（藤岡大塚店）",
  "総労働時間（藤岡大塚店）",
  "所定時間（平日）（藤岡大塚店）",
  "休憩時間（平日）（藤岡大塚店）",
  "深夜所定時間（平日）（藤岡大塚店）",
  "深夜休憩時間（平日）（藤岡大塚店）",
  "所定外時間（平日）（藤岡大塚店）",
  "法定外時間（平日）（藤岡大塚店）",
  "深夜所定外時間（平日）（藤岡大塚店）",
  "深夜法定外時間（平日）（藤岡大塚店）",
  "所定外休憩時間（平日）（藤岡大塚店）",
  "深夜所定外休憩時間（平日）（藤岡大塚店）",
  "法定外休憩時間（平日）（藤岡大塚店）",
  "深夜法定外休憩時間（平日）（藤岡大塚店）",
  "遅刻時間（平日）（藤岡大塚店）",
  "早退時間（平日）（藤岡大塚店）",
  "所定時間（所定休日）（藤岡大塚店）",
  "休憩時間（所定休日）（藤岡大塚店）",
  "深夜所定時間（所定休日）（藤岡大塚店）",
  "深夜休憩時間（所定休日）（藤岡大塚店）",
  "所定外時間（所定休日）（藤岡大塚店）",
  "法定外時間（所定休日）（藤岡大塚店）",
  "深夜所定外時間（所定休日）（藤岡大塚店）",
  "深夜法定外時間（所定休日）（藤岡大塚店）",
  "所定外休憩時間（所定休日）（藤岡大塚店）",
  "深夜所定外休憩時間（所定休日）（藤岡大塚店）",
  "法定外休憩時間（所定休日）（藤岡大塚店）",
  "深夜法定外休憩時間（所定休日）（藤岡大塚店）",
  "遅刻時間（所定休日）（藤岡大塚店）",
  "早退時間（所定休日）（藤岡大塚店）",
  "所定時間（法定休日）（藤岡大塚店）",
  "休憩時間（法定休日）（藤岡大塚店）",
  "深夜所定時間（法定休日）（藤岡大塚店）",
  "深夜休憩時間（法定休日）（藤岡大塚店）",
  "所定外時間（法定休日）（藤岡大塚店）",
  "法定外時間（法定休日）（藤岡大塚店）",
  "深夜所定外時間（法定休日）（藤岡大塚店）",
  "深夜法定外時間（法定休日）（藤岡大塚店）",
  "所定外休憩時間（法定休日）（藤岡大塚店）",
  "深夜所定外休憩時間（法定休日）（藤岡大塚店）",
  "法定外休憩時間（法定休日）（藤岡大塚店）",
  "深夜法定外休憩時間（法定休日）（藤岡大塚店）",
  "遅刻時間（法定休日）（藤岡大塚店）",
  "早退時間（法定休日）（藤岡大塚店）",
];

const TARGET_COLUMN_KEYWORD = "総労働時間（藤岡大塚店）";

/** CSVテキストから KEEP_COLUMNS のみ抽出して新しいCSV文字列を返す */
function trimCsvColumns(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return text;
  const allHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const keepIndices = KEEP_COLUMNS
    .map((col) => allHeaders.indexOf(col))
    .filter((idx) => idx !== -1);
  const keepHeaders = keepIndices.map((idx) => allHeaders[idx]);
  const csvLines: string[] = [keepHeaders.join(",")];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const trimmed = keepIndices.map((idx) => values[idx] ?? "");
    csvLines.push(trimmed.join(","));
  }
  return csvLines.join("\n");
}


// 時給設定
const BASE_HOURLY = 1100;
const CATEGORY_MULTIPLIER: Record<string, number> = {
  A: 1,
  B: 1.15454545455,
  C: 1.16363636364,
};

interface AttendanceRow {
  [key: string]: string;
}

interface AttendanceUploadProps {
  folderName: string;
  onSubmit: (data: { item_name: string; amount: number | string; datafile?: string }) => Promise<void>;
  onBack: () => void;
}

function parseMinutes(value: string): number {
  if (!value || value === "00:00") return 0;
  const parts = value.trim().split(":");
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function toDecimalHours(totalMin: number): number {
  return Math.round((totalMin / 60) * 100) / 100;
}

function formatDecimalHours(totalMin: number): string {
  return `${toDecimalHours(totalMin)}`;
}

function calcLaborCost(minutes: number, category: string): number {
  const multiplier = CATEGORY_MULTIPLIER[category] ?? 1;
  const hours = minutes / 60;
  return Math.round(BASE_HOURLY * multiplier * hours);
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function AttendanceUpload({ folderName, onSubmit, onBack }: AttendanceUploadProps) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [totalMinutes, setTotalMinutes] = useState<number>(0);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [rowCategories, setRowCategories] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function calcTotalLaborCost(): number {
    return rows
      .filter((row) => targetColumn && parseMinutes(row[targetColumn] ?? "") > 0)
      .reduce((acc, row) => {
        const empNo = row["従業員番号"] ?? "";
        const cat = rowCategories[empNo];
        if (!cat) return acc;
        const minutes = parseMinutes(row[targetColumn] ?? "");
        return acc + calcLaborCost(minutes, cat);
      }, 0);
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return;
    const hdrs = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

    const data: AttendanceRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: AttendanceRow = {};
      hdrs.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
      data.push(row);
    }
    setRows(data);

    const col =
      hdrs.find((h) => h === TARGET_COLUMN_KEYWORD) ??
      hdrs.find((h) => h.includes("総労働時間") && h.includes("藤岡大塚"));
    setTargetColumn(col ?? "");

    if (col) {
      const sumMin = data.reduce((acc, row) => acc + parseMinutes(row[col] ?? ""), 0);
      setTotalMinutes(sumMin);
      toast.success(`${col} の合計: ${formatDecimalHours(sumMin)} 時間`);
    } else {
      setTotalMinutes(0);
      toast.warning("「総労働時間（藤岡大塚店）」カラムが見つかりませんでした");
    }
  }

  async function handleFile(file: File) {
    setFileObj(file);
    setDriveUrl("");
    setRowCategories({});

    // CSVを一度読み込んで parse + trim 両方に使う
    const originalText = await file.text();
    parseCSV(originalText);

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "csv";
      const uploadFileName = `${folderName}_勤怠.${ext}`;

      // 必要カラムのみトリミングしてからアップロード
      const trimmedText = trimCsvColumns(originalText);
      const trimmedFile = new File(
        [new Blob([trimmedText], { type: "text/csv" })],
        uploadFileName,
        { type: "text/csv" }
      );

      const fd = new FormData();
      fd.append("file", trimmedFile);
      fd.append("file_name", uploadFileName);
      fd.append("folder_name", folderName);
      const res = await fetch("/api/upload-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "アップロードエラー");
      setDriveUrl(data.url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Driveアップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileObj || rows.length === 0) {
      toast.error("CSVファイルを選択してください");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        item_name: "勤怠",
        amount: totalLaborCost, // カテゴリー別に算出した合計人件費（円）
        datafile: driveUrl || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalLaborCost = calcTotalLaborCost();
  const activeRows = rows.filter((r) => targetColumn && parseMinutes(r[targetColumn] ?? "") > 0);
  const categorizedCount = Object.values(rowCategories).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 border border-yellow-400/30 bg-yellow-400/5 text-yellow-400 text-xs tracking-wider md:hidden">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>勤怠データのアップロードはPC画面での操作を推奨します。</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-border bg-secondary p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-secondary/80 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file?.name.endsWith(".csv")) void handleFile(file);
            else toast.error("CSVファイルを選択してください");
          }}
        >
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          {fileObj ? (
            <p className="font-bold text-sm text-primary tracking-widest">読み込み完了</p>
          ) : (
            <>
              <p className="font-bold text-sm text-foreground tracking-widest uppercase">勤怠 CSV をドロップ</p>
              <p className="text-xs text-muted-foreground mt-1.5 tracking-wider">またはクリックして選択</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) void handleFile(e.target.files[0]); }}
          />
        </div>

        {/* Drive アップロード中 */}
        {isUploading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wider">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Google Drive にアップロード中...
          </div>
        )}

        {/* 集計結果 */}
        {rows.length > 0 && (
          <div className="border border-border bg-secondary p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
              <Clock className="w-3.5 h-3.5" />
              集計結果
            </div>
            {targetColumn ? (
              <>
                <p className="text-2xl font-black text-primary tracking-wider">
                  {formatDecimalHours(totalMinutes)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">時間（合計労働時間）</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const h = Math.floor(totalMinutes / 60);
                    const m = totalMinutes % 60;
                    const hhmm = `${h}:${String(m).padStart(2, "0")}`;
                    return `${hhmm} → ${h}時間 + ${m}分 ÷ 60 = ${formatDecimalHours(totalMinutes)} 時間`;
                  })()}
                </p>
              </>
            ) : (
              <p className="text-xs text-yellow-400">
                「総労働時間（藤岡大塚店）」カラムが見つかりませんでした。CSVの形式を確認してください。
              </p>
            )}
          </div>
        )}

        {/* 人件費試算 */}
        {categorizedCount > 0 && (
          <div className="border border-border bg-secondary p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
              <Banknote className="w-3.5 h-3.5" />
              人件費試算（カテゴリー設定済: {categorizedCount} 名）
            </div>
            <div className="space-y-1">
              {activeRows
                .filter((row) => !!rowCategories[row["従業員番号"] ?? ""])
                .map((row, i) => {
                  const empNo = row["従業員番号"] ?? String(i);
                  const cat = rowCategories[empNo];
                  const minutes = parseMinutes(row[targetColumn] ?? "");
                  const cost = calcLaborCost(minutes, cat);
                  const hourlyRate = Math.round(BASE_HOURLY * CATEGORY_MULTIPLIER[cat]);
                  return (
                    <div key={empNo} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {row["氏名"]}
                        <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary font-bold text-[10px]">{cat}</span>
                        <span className="ml-1 text-muted-foreground">
                          ¥{hourlyRate.toLocaleString()}/h × {toDecimalHours(minutes)}h
                        </span>
                      </span>
                      <span className="font-bold text-foreground">{formatYen(cost)}</span>
                    </div>
                  );
                })}
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground tracking-wider">合計人件費</span>
              <span className="text-xl font-black text-primary">{formatYen(totalLaborCost)}</span>
            </div>
            {categorizedCount < activeRows.length && (
              <p className="text-[10px] text-muted-foreground">
                ※ カテゴリー未設定の {activeRows.length - categorizedCount} 名は計���に含まれていません
              </p>
            )}
          </div>
        )}

        {/* CSV プレビュー - 00:00 のスタッフは非表示 */}
        {rows.length > 0 && (
          <div className="space-y-2">
            {/* カテゴ��ー凡例 */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { key: "A", label: "社保無" },
                { key: "B", label: "社保有 / 40歳未満" },
                { key: "C", label: "社保有 / 40歳以上" },
              ].map(({ key, label }) => (
                <span key={key} className="flex items-center gap-1.5 text-[10px] tracking-wider text-muted-foreground">
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary font-bold text-[10px]">{key}</span>
                  {label}
                </span>
              ))}
            </div>

            <div className="border border-border overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead className="bg-primary text-primary-foreground sticky top-0">
                <tr>
                  {["従業員番号", "氏名", targetColumn].filter(Boolean).map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left font-bold tracking-wider whitespace-nowrap">
                    カテゴリー
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-secondary">
                {activeRows.map((row, i) => {
                  const empNo = row["従業員番号"] ?? String(i);
                  return (
                    <tr key={empNo} className="hover:bg-card transition-colors">
                      {["従業員番号", "氏名", targetColumn].filter(Boolean).map((h) => (
                        <td key={h} className="px-3 py-2 whitespace-nowrap text-foreground tracking-wide">
                          {row[h]}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <select
                          value={rowCategories[empNo] ?? ""}
                          onChange={(e) =>
                            setRowCategories((prev) => ({ ...prev, [empNo]: e.target.value }))
                          }
                          className="bg-card border border-border text-foreground text-xs px-2 py-1 focus:outline-none focus:border-primary"
                        >
                          <option value="">-</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="border border-border py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
          >
            戻る
          </button>
          <button
            type="submit"
            className="bg-primary text-primary-foreground py-3 text-xs tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isSubmitting || isUploading || rows.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                登録中
              </>
            ) : (
              "登録する"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
