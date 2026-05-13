"use client";

import { useState, useRef } from "react";
import { Camera, FileSpreadsheet, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AmazonCsvUploadProps {
  folderName: string;
  category: string;
  onSubmit: (data: { item_name: string; amount: number; datafile?: string }) => Promise<void>;
  onBack: () => void;
}

// 注文番号列(index 1)でユニーク集計し、注文の合計（税込）(index 10)を合算
function calcTotal(rows: string[][]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const row of rows) {
    const orderId = row[1]?.trim();
    const rawAmount = row[10]?.trim().replace(/[",¥]/g, "");
    const amount = Number(rawAmount);
    if (!orderId || seen.has(orderId)) continue;
    const status = row[11]?.trim();
    if (status === "キャンセル済み") continue;
    if (!isNaN(amount) && amount > 0) {
      seen.add(orderId);
      total += amount;
    }
  }
  return total;
}

function parseCSVRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.slice(1).map((line) =>
    line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
  );
}

type Mode = "select" | "camera" | "csv";

// v2: モード選択付き（カメラ撮影 / CSV アップロード）
export function AmazonCsvUpload({ folderName, category, onSubmit, onBack }: AmazonCsvUploadProps) {
  const [mode, setMode] = useState<Mode>("select");

  // カメラ用
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [cameraAmount, setCameraAmount] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string>("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  // CSV用
  const [csvFileName, setCsvFileName] = useState("");
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [csvDriveUrl, setCsvDriveUrl] = useState<string>("");
  const [isCsvUploading, setIsCsvUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- カメラモード ---
  async function handleImageFile(file: File) {
    setPreviewUrl(URL.createObjectURL(file));
    setDriveUrl("");
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      // ファイル名: folder_name_item_name（item_nameは登録時に確定するため、先に暫定アップ）
      // item_nameが空の場合は「備品」とする
      const nameForFile = itemName.trim() || "備品";
      const uploadFileName = `${folderName}_${nameForFile}.${ext}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("file_name", uploadFileName);
      const res = await fetch("/api/upload-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "アップロードエラー");
      setDriveUrl(data.url);
      toast.success("Google Drive にアップロードしました");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCameraSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim()) { toast.error("品目名を入力してください"); return; }
    if (!cameraAmount) { toast.error("合計金額を入力してください"); return; }
    setIsSubmitting(true);
    try {
      await onSubmit({
        item_name: itemName.trim(),
        amount: Number(cameraAmount),
        datafile: driveUrl || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- CSVモード ---
  async function handleCsvFile(file: File) {
    setCsvFileName(file.name);
    setCsvDriveUrl("");
    setTotalAmount(null);
    const text = await file.text();
    const rows = parseCSVRows(text);
    const total = calcTotal(rows);
    setTotalAmount(total);
    toast.success(`集計完了: ¥${total.toLocaleString()}`);

    setIsCsvUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "csv";
      const uploadFileName = `${folderName}_${category}.${ext}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("file_name", uploadFileName);
      const res = await fetch("/api/upload-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "アップロードエラー");
      setCsvDriveUrl(data.url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Driveアップロードに失敗しました");
    } finally {
      setIsCsvUploading(false);
    }
  }

  async function handleCsvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totalAmount === null) { toast.error("CSVファイルを選択してください"); return; }
    setIsSubmitting(true);
    try {
      await onSubmit({
        item_name: "備品",
        amount: totalAmount,
        datafile: csvDriveUrl || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- モード選択画面 ---
  if (mode === "select") {
    return (
      <div className="space-y-4">
        <p className="text-xs tracking-widest uppercase text-muted-foreground">登録方法を選択</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("camera")}
            className="flex flex-col items-center gap-3 border border-border bg-card hover:border-primary/60 hover:bg-secondary transition-colors py-8"
          >
            <Camera className="w-6 h-6 text-primary" />
            <span className="text-xs tracking-widest uppercase font-bold">カメラ撮影</span>
            <span className="text-[10px] text-muted-foreground tracking-wide px-2 text-center">店舗購入の領収書</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("csv")}
            className="flex flex-col items-center gap-3 border border-border bg-card hover:border-primary/60 hover:bg-secondary transition-colors py-8"
          >
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            <span className="text-xs tracking-widest uppercase font-bold">CSV アップロード</span>
            <span className="text-[10px] text-muted-foreground tracking-wide px-2 text-center">Amazon 注文履歴</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-full border border-border py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        >
          戻る
        </button>
      </div>
    );
  }

  // --- カメラ撮影モード ---
  if (mode === "camera") {
    return (
      <form onSubmit={handleCameraSubmit} className="space-y-5">
        {/* 撮影ボタン */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 border border-border bg-secondary py-3 text-xs tracking-widest uppercase hover:border-primary/60 transition-colors"
          >
            <Camera className="w-4 h-4" /> カメラ撮影
          </button>
          <button
            type="button"
            onClick={() => filePickerRef.current?.click()}
            className="flex items-center justify-center gap-2 border border-border bg-secondary py-3 text-xs tracking-widest uppercase hover:border-primary/60 transition-colors"
          >
            <Upload className="w-4 h-4" /> ファイル選択
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
          <input ref={filePickerRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
        </div>

        {/* プレビュー */}
        {previewUrl && (
          <div className="border border-border bg-secondary/40 overflow-hidden aspect-video flex items-center justify-center">
            <img src={previewUrl} alt="領収書プレビュー" className="max-h-48 object-contain" />
          </div>
        )}

        {isUploading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wider">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Google Drive にアップロード中...
          </div>
        )}

        {/* 品目名 */}
        <div className="space-y-1.5">
          <label className="text-xs tracking-widest uppercase text-muted-foreground">
            品目名 <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="例：ボールペン、コピー用紙"
            className="w-full bg-input border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            required
          />
        </div>

        {/* 合計金額 */}
        <div className="space-y-1.5">
          <label className="text-xs tracking-widest uppercase text-muted-foreground">
            合計金額 <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center border border-border bg-input px-3 py-2.5 focus-within:border-primary">
            <span className="text-muted-foreground text-sm mr-1.5">¥</span>
            <input
              type="number"
              min="0"
              value={cameraAmount}
              onChange={(e) => setCameraAmount(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={() => setMode("select")}
            className="border border-border py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
            戻る
          </button>
          <button type="submit"
            className="bg-primary text-primary-foreground py-3 text-xs tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isSubmitting || isUploading}>
            {isSubmitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />登録中</> : "登録する"}
          </button>
        </div>
      </form>
    );
  }

  // --- CSV アップロードモード ---
  return (
    <form onSubmit={handleCsvSubmit} className="space-y-5">
      <div
        className="border-2 border-dashed border-border bg-secondary p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-secondary/80 transition-colors"
        onClick={() => csvInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file?.name.endsWith(".csv")) handleCsvFile(file);
          else toast.error("CSVファイルを選択してください");
        }}
      >
        <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        {csvFileName ? (
          <p className="font-bold text-sm text-primary tracking-widest">{csvFileName}</p>
        ) : (
          <>
            <p className="font-bold text-sm text-foreground tracking-widest uppercase">Amazon 注文CSV をドロップ</p>
            <p className="text-xs text-muted-foreground mt-1.5 tracking-wider">またはクリックして選択</p>
          </>
        )}
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])} />
      </div>

      {isCsvUploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wider">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Google Drive にアップロード中...
        </div>
      )}

      {totalAmount !== null && (
        <div className="border border-border bg-card px-4 py-4 space-y-1">
          <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">注文合計（税込）集計結果</p>
          <p className="text-2xl font-black tracking-tight text-foreground">¥{totalAmount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground tracking-wide">※ キャンセル済みおよび重複注文番号を除いた合計です</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={() => setMode("select")}
          className="border border-border py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
          戻る
        </button>
        <button type="submit"
          className="bg-primary text-primary-foreground py-3 text-xs tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          disabled={isSubmitting || isCsvUploading || totalAmount === null}>
          {isSubmitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />登録中</> : "登録する"}
        </button>
      </div>
    </form>
  );
}
