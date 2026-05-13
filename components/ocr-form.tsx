"use client";

import { useState, useRef } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/components/category-selector";

interface ReceiptFormProps {
  category: ExpenseCategory;
  folderName: string;
  onSubmit: (data: { item_name: string; amount: number; datafile?: string }) => Promise<void>;
  onBack: () => void;
}

export function OcrForm({ category, folderName, onSubmit, onBack }: ReceiptFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [driveUrl, setDriveUrl] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isEquipment = category === "備品";

  async function processFile(file: File) {
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewType(file.type === "application/pdf" ? "pdf" : "image");

    // Google Drive へアップロード
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `${folderName}_${category}.${ext}`;

      const fd = new FormData();
      fd.append("file", file);
      fd.append("file_name", fileName);
      const uploadRes = await fetch(`/api/upload-receipt`, { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error ?? "アップロードエラー");
      setDriveUrl(uploadData.url);
      toast.success("Google Drive にアップロードしました");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totalAmount) {
      toast.error("合計金額を入力してください");
      return;
    }
    setIsSubmitting(true);
    try {
      const finalItemName = isEquipment
        ? (itemName.trim() || category)
        : (category as string);
      await onSubmit({
        item_name: finalItemName,
        amount: Number(totalAmount),
        datafile: driveUrl || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Capture buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-2 border border-border bg-secondary py-3 text-xs tracking-widest uppercase text-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Camera className="w-4 h-4" />
          カメラ撮影
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 border border-border bg-secondary py-3 text-xs tracking-widest uppercase text-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Upload className="w-4 h-4" />
          ファイル選択
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="relative border border-border h-40 overflow-hidden bg-secondary">
          {previewType === "pdf" ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <svg className="w-10 h-10 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-xs tracking-widest uppercase font-bold text-primary">PDF 読み込み完了</p>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline underline-offset-2">
                プレビューを開く
              </a>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="領収書プレビュー"
              className="w-full h-full object-contain"
            />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-xs tracking-widest uppercase text-primary font-medium">
                Drive アップロード中...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Drive URL confirmation - 非表示（URLはバックグラウンドで保存） */}

      {/* 備品: 品目名入力 */}
      {isEquipment && (
        <div className="space-y-2">
          <Label htmlFor="item-name" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            品目名 <span className="text-primary">*</span>
          </Label>
          <Input
            id="item-name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="例：コピー用紙、ボールペン"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
      )}

      {/* 合計金額 */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
          合計金額 <span className="text-primary">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">¥</span>
          <Input
            id="amount"
            type="text"
            inputMode="numeric"
            value={totalAmount}
            onChange={(e) => {
              // 半角数字のみ許可
              const v = e.target.value.replace(/[^0-9]/g, "");
              setTotalAmount(v);
            }}
            placeholder="0"
            className="pl-7 bg-input border-border text-foreground"
            required
          />
        </div>
      </div>

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
          disabled={isSubmitting || isUploading}
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
  );
}
