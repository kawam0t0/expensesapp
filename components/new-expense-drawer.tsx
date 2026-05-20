"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Paperclip, Check, Camera, X as XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// フォーム項目定義
// ---------------------------------------------------------------------------
interface FormField {
  category: string;
  item_name: string;
  label: string;
  indent?: number;
  allowFile?: boolean;
  multiFile?: boolean;
  autoCalc?: boolean;
  defaultValue?: number;
  csvCalc?: boolean;
  required?: boolean;
  amazonCsv?: boolean; // Amazon/Cainz等のCSVから支払い金額を集計
}

interface HonbuStaff {
  name: string;
  minutes: number;
  enabled: boolean;
}

const HONBU_HOURLY = 2000;
const TARGET_COLUMN = "総労働時間（藤岡大塚店）";

/** "HH:MM" を分に変換 */
function parseMinutes(value: string): number {
  if (!value || value === "00:00") return 0;
  const parts = value.trim().split(":");
  if (parts.length !== 2) return 0;
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

const SALES_FIELDS: FormField[] = [
  { category: "売上", item_name: "現金売上", label: "現金売上", required: true, allowFile: true, multiFile: true },
  { category: "売上", item_name: "キャッシュレス売上", label: "キャッシュレス売上", required: true, allowFile: true, multiFile: true },
  { category: "売上", item_name: "サブスク売上", label: "サブスク売上", required: true, allowFile: true, multiFile: true },
];

const EXPENSE_FIELDS: FormField[] = [
  // 人件費
  { category: "運営費用", item_name: "人件費（藤岡大塚店）", label: "藤岡大塚店スタッフ", indent: 1, allowFile: true, multiFile: true, required: true },
  { category: "運営費用", item_name: "人件費（本部）", label: "本部スタッフ", indent: 1, allowFile: true, multiFile: true, csvCalc: true, required: true },
  { category: "運営費用", item_name: "福利厚生費", label: "福利厚生費", indent: 1, allowFile: true, multiFile: true },
  // ロイヤリティ・運営代行費（売上の5% 自動計算）
  { category: "運営費用", item_name: "ロイヤリティ", label: "ロイヤリティ（売上の5%）", autoCalc: true, allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "運営代行費", label: "運営代行費（売上の5%）", autoCalc: true, allowFile: true, multiFile: true },
  // インフラ料金
  { category: "運営費用", item_name: "水道料金", label: "水道料金", allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "電気料金", label: "電気料金", allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "ガス料金", label: "ガス料金", allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "通信費", label: "通信費", allowFile: true, multiFile: true },
  // 運営備品費
  { category: "運営費用", item_name: "運営備品費（販促グッズ類）", label: "販促グッズ類", indent: 1, allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "運営備品費（液剤費）", label: "液剤費", indent: 1, allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "運営備品費（その他備品費用）", label: "その他備品費用(amazon,cainz等)", indent: 1, allowFile: true, multiFile: true },
  // 固定費
  { category: "運営費用", item_name: "保険費用", label: "保険費用", defaultValue: 31500, allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "関東電気保安協会費用", label: "関東電気保安協会費用", defaultValue: 17600, allowFile: true, multiFile: true },
  { category: "運営費用", item_name: "システム利用料", label: "システム利用料", defaultValue: 35000, allowFile: true, multiFile: true },
];

// セクションヘッダー: EXPENSE_FIELDS の index => 中項目ラベル
const EXPENSE_GROUP_HEADERS: Record<number, { label: string; color: string }> = {
  0:  { label: "人件費", color: "bg-blue-500/10 text-blue-600" },
  3:  { label: "ロイヤリティ・運営代行費", color: "bg-blue-500/10 text-blue-600" },
  5:  { label: "インフラ料金", color: "bg-blue-500/10 text-blue-600" },
  9:  { label: "運営備品費", color: "bg-blue-500/10 text-blue-600" },
  12: { label: "固定費", color: "bg-blue-500/10 text-blue-600" },
};

const ALL_FIELDS = [...SALES_FIELDS, ...EXPENSE_FIELDS];

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
type Step = "folder" | "form";

interface NewExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  onRegistered: () => void;
  initialFolderName?: string;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------
export function NewExpenseDrawer({
  open,
  onClose,
  onRegistered,
  initialFolderName,
}: NewExpenseDrawerProps) {
  const [step, setStep] = useState<Step>("folder");
  const [folderName, setFolderName] = useState("");

  // 各フィールドの金額
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // 各フィールドの添付ファイル（単一）
  const [files, setFiles] = useState<Record<string, File>>({});
  // 複数ファイル添付
  const [multiFiles, setMultiFiles] = useState<Record<string, File[]>>({});
  // 本部スタッフ一覧（CSVから取得、❌で除外可能）
  const [honbuStaffs, setHonbuStaffs] = useState<HonbuStaff[]>([]);
  // アップロード済みURL
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ saved_at: string; amounts: Record<string, string>; uploadedUrls: Record<string, string> } | null>(null);
  // Amazon/Cainz CSVから集計した金額
  const [amazonCsvAmount, setAmazonCsvAmount] = useState(0);
  // プレビューダイアログ
  const [previewFiles, setPreviewFiles] = useState<File[] | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  // カメラアクションシート
  const [actionSheetField, setActionSheetField] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) return;

    // デフォルト値
    const defaults: Record<string, string> = {};
    for (const f of EXPENSE_FIELDS) {
      if (f.defaultValue) defaults[f.item_name] = String(f.defaultValue);
    }

    if (initialFolderName) {
      setFolderName(initialFolderName);
      setStep("form");
      setFiles({});
      setMultiFiles({});
      setUploadedUrls({});
      setHonbuStaffs([]);
      setDraftInfo(null);
      setAmazonCsvAmount(0);

      // 下書きをフェッチして amounts と uploadedUrls に自動適用
      fetch(`/api/drafts/load?folder_name=${encodeURIComponent(initialFolderName)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.draft) {
            const saved: Record<string, string> = JSON.parse(data.draft.amounts_json);
            const savedUrls: Record<string, string> = JSON.parse(data.draft.files_json ?? "{}");
            setAmounts({ ...defaults, ...saved });
            setUploadedUrls(savedUrls);
          } else {
            setAmounts(defaults);
          }
        })
        .catch(() => setAmounts(defaults));
    } else {
      setFolderName("");
      setStep("folder");
      setAmounts(defaults);
      setFiles({});
      setMultiFiles({});
      setUploadedUrls({});
      setHonbuStaffs([]);
      setDraftInfo(null);
      setAmazonCsvAmount(0);
    }
  }, [open, initialFolderName]);

  if (!open) return null;

  // ドラフト���存
  async function handleDraftSave() {
    if (!folderName.trim()) { toast.error("件名を入力してください"); return; }
    setIsSavingDraft(true);
    try {
      // まだアップロードされていないファイルをDriveへ保存
      const urls: Record<string, string> = { ...uploadedUrls };
      for (const field of ALL_FIELDS) {
        const mFiles = multiFiles[field.item_name];
        if (mFiles && mFiles.length > 0 && !urls[field.item_name]) {
          const uploadedList: string[] = [];
          for (let i = 0; i < mFiles.length; i++) {
            try {
              const url = await uploadFile(field.item_name, mFiles[i], String(i + 1));
              uploadedList.push(url);
            } catch {
              // アップロード失敗は無視して続行
            }
          }
          if (uploadedList.length > 0) {
            urls[field.item_name] = uploadedList.join("\n");
          }
        }
      }
      setUploadedUrls(urls);

      const res = await fetch("/api/drafts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_name: folderName, amounts, uploaded_urls: urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("下書きを保存しました（ファイル含む）");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "下書き保存に失敗しました");
    } finally {
      setIsSavingDraft(false);
    }
  }

  // フォルダ名確定時に下書きチェック
  async function checkDraft(name: string) {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/drafts/load?folder_name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.draft) {
        setDraftInfo({
          saved_at: data.draft.saved_at,
          amounts: JSON.parse(data.draft.amounts_json),
          uploadedUrls: JSON.parse(data.draft.files_json ?? "{}"),
        });
      } else {
        setDraftInfo(null);
      }
    } catch { setDraftInfo(null); }
  }

  /** Amazon/Cainz注文履歴CSVから「支払い金額」を合計してその他備品費用に加算 */
  async function handleAmazonCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return;
    const hdrs = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const payIdx = hdrs.indexOf("支払い金額");
    if (payIdx === -1) {
      toast.error("「支払い金額」カラムが見つかりません");
      return;
    }
    let total = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, "").replace(/[^\d]/g, ""));
      const n = parseInt(vals[payIdx] ?? "0", 10);
      if (!isNaN(n)) total += n;
    }
    setAmazonCsvAmount(total);
    // 手入力の金額との合算
    const manualAmount = parseInt(amounts["運営備品費（その他備品費用）"] ?? "0", 10) || 0;
    setAmounts((prev) => ({ ...prev, "運営備品費（その他備品費用）": String(manualAmount + total) }));
    toast.success(`Amazon/Cainz CSV: ¥${total.toLocaleString()} を集計しました`);
  }

  /** 下書き復元 */
  function restoreDraft() {
    if (!draftInfo) return;
    setAmounts((prev) => ({ ...prev, ...draftInfo.amounts }));
    setUploadedUrls((prev) => ({ ...prev, ...draftInfo.uploadedUrls }));
    setDraftInfo(null);
    setStep("form");
    toast.success("下書きを復元しました");
  }

  // 下書き破棄
  async function discardDraft() {
    if (!draftInfo) return;
    await fetch(`/api/drafts/delete?folder_name=${encodeURIComponent(folderName)}`, { method: "DELETE" }).catch(() => {});
    setDraftInfo(null);
  }


  const salesTotal = SALES_FIELDS.reduce(
    (acc, f) => acc + (parseInt(amounts[f.item_name] ?? "0", 10) || 0),
    0
  );

  // FCfee と 運営代行費 の自動計算値
  const autoCalcValue = Math.round(salesTotal * 0.05);

  // 運営費用合計��autoCalc項目は salesTotal * 0.05 で計算）
  const expenseTotal = EXPENSE_FIELDS.reduce((acc, f) => {
    if (f.autoCalc) return acc + (salesTotal > 0 ? autoCalcValue : 0);
    return acc + (parseInt(amounts[f.item_name] ?? "0", 10) || 0);
  }, 0);

  /** 本部スタッフ用: CSVから総労働時間を集計してスタッフ一覧をセット */
  async function handleHonbuCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return;
    const hdrs = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const timeIdx =
      hdrs.indexOf(TARGET_COLUMN) !== -1
        ? hdrs.indexOf(TARGET_COLUMN)
        : hdrs.findIndex((h) => h.includes("総労働時間") && h.includes("藤岡大塚"));
    const nameIdx = hdrs.indexOf("氏名");
    if (timeIdx === -1) {
      toast.error("「総労働時間（藤岡大塚店）」カラムが見つかりません");
      return;
    }
    const staffList: HonbuStaff[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const mins = parseMinutes(vals[timeIdx] ?? "");
      if (mins > 0) {
        staffList.push({
          name: nameIdx !== -1 ? (vals[nameIdx] ?? `行${i}`) : `行${i}`,
          minutes: mins,
          enabled: true,
        });
      }
    }
    setHonbuStaffs(staffList);
    const totalCost = staffList.reduce((s, st) => s + Math.round((st.minutes / 60) * HONBU_HOURLY), 0);
    setAmounts((prev) => ({ ...prev, "人件費（本部）": String(totalCost) }));
    toast.success(`本部スタッフ ${staffList.length}名を読み込みました`);
  }

  /** 本部スタッフの有効/無効が変わるたびに金額を再計算 */
  function toggleHonbuStaff(index: number) {
    setHonbuStaffs((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s));
      const totalCost = next
        .filter((s) => s.enabled)
        .reduce((sum, s) => sum + Math.round((s.minutes / 60) * HONBU_HOURLY), 0);
      setAmounts((a) => ({ ...a, "人件費（本部）": String(totalCost) }));
      return next;
    });
  }

  function handleClose() {
    setStep("folder");
    setFolderName("");
    setAmounts({});
    setFiles({});
    setMultiFiles({});
    setUploadedUrls({});
    onClose();
  }

  async function handleFolderNext(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) {
      toast.error("件名を入力してください");
      return;
    }
    await checkDraft(folderName);
    setStep("form");
  }

  function handleBack() {
    if (step === "form" && initialFolderName) {
      handleClose();
    } else {
      setStep("folder");
    }
  }

  function setAmount(key: string, value: string) {
    const v = value.replace(/[^0-9]/g, "");
    setAmounts((prev) => ({ ...prev, [key]: v }));
  }

  // ファイルをDriveにアップロード
  async function uploadFile(key: string, file: File, suffix?: string): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const fileName = suffix
      ? `${folderName}_${key}_${suffix}.${file.name.split(".").pop()}`
      : `${folderName}_${key}.${file.name.split(".").pop()}`;
    fd.append("file_name", fileName);
    fd.append("folder_name", folderName);
    const res = await fetch("/api/upload-receipt", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "アップロードエラー");
    return data.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 必須項目バリデーション
    const requiredFields = ALL_FIELDS.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => {
      const raw = amounts[f.item_name];
      // 未入力（undefined/空文字）のみエラー。0は有効な入力値として許可
      return raw === undefined || raw === "";
    });
    if (missingFields.length > 0) {
      toast.error(`入力必須項目を入力してください: ${missingFields.map((f) => f.label).join("、")}`);
      return;
    }

    // 金額 > 0 の項目を抽出（autoCalc は salesTotal > 0 のとき追加）
    const activeItems: { field: FormField; amount: number }[] = [];
    for (const f of ALL_FIELDS) {
      if (f.autoCalc) {
        if (salesTotal > 0) {
          activeItems.push({ field: f, amount: autoCalcValue });
        }
      } else {
        const val = parseInt(amounts[f.item_name] ?? "0", 10);
        if (val > 0) {
          activeItems.push({ field: f, amount: val });
        }
      }
    }

    if (activeItems.length === 0) {
      toast.error("1つ以上の項目に金額を入力してくださ���");
      return;
    }

    setIsSubmitting(true);
    try {
      // ファイルアップロード
      const urls: Record<string, string> = { ...uploadedUrls };
      for (const { field } of activeItems) {
        // 単一ファイル
        const file = files[field.item_name];
        if (file && !urls[field.item_name]) {
          try {
            urls[field.item_name] = await uploadFile(field.item_name, file);
          } catch {
            toast.error(`${field.label} のファイルアップロードに失敗しました`);
          }
        }
        // 複数ファイル
        const mFiles = multiFiles[field.item_name];
        if (mFiles && mFiles.length > 0 && !urls[field.item_name]) {
          try {
            const uploadedList: string[] = [];
            for (let i = 0; i < mFiles.length; i++) {
              const url = await uploadFile(field.item_name, mFiles[i], String(i + 1));
              uploadedList.push(url);
            }
            urls[field.item_name] = uploadedList.join("\n");
          } catch {
            toast.error(`${field.label} のファイルアップロードに失敗しました`);
          }
        }
      }
      setUploadedUrls(urls);

      // バルク登録
      const items = activeItems.map(({ field, amount }) => ({
        category: field.category,
        item_name: field.item_name,
        amount,
        datafile: urls[field.item_name] ?? "",
      }));

      const res = await fetch("/api/expenses/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_name: folderName, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "登録に失敗しました");

      toast.success(`${items.length} 件を登録しました`);
      onRegistered();
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ============================================================
  // Render
  // ============================================================

  // フォルダ名入力ステップ
  if (step === "folder") {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={handleClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-card border border-border w-full max-w-md shadow-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-full bg-primary" />
            <div className="px-6 py-5">
              <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-1">Step 1 / 2</p>
              <h2 className="text-sm font-bold text-foreground tracking-widest mb-5">件名を入力</h2>
              <form onSubmit={handleFolderNext} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="folder-name" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
                    件名 <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="folder-name"
                    autoFocus
                    placeholder="例：2026年3月度"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleClose} className="border border-border py-3 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
                    キャンセル
                  </button>
                  <button type="submit" className="bg-primary text-primary-foreground text-xs tracking-[0.25em] uppercase font-bold py-3 hover:bg-primary/90 transition-colors">
                    次へ進む
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  function openPreview(fileList: File[]) {
    setPreviewFiles(fileList);
    // 画像・PDF はすべてObjectURLを生成、CSVのみ空文字
    const urls = fileList.map((f) => {
      if (f.type.startsWith("image/") || f.type === "application/pdf") {
        return URL.createObjectURL(f);
      }
      return "";
    });
    setPreviewUrls(urls);
  }

  function closePreview() {
    previewUrls.forEach((u) => { if (u) URL.revokeObjectURL(u); });
    setPreviewFiles(null);
    setPreviewUrls([]);
  }

  // フォームページ入力フォーム
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="h-1 w-full bg-primary" />
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="戻る">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                Step 2 / 2
              </p>
              <h2 className="text-sm font-bold text-foreground tracking-widest mt-0.5">
                入力フォーム
              </h2>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="閉じる">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Folder name badge */}
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <div className="w-1 h-4 bg-primary shrink-0" />
            <p className="text-sm text-muted-foreground tracking-wider">
              件名: <span className="font-bold text-foreground text-base">{folderName}</span>
            </p>
          </div>

          {/* ======== 売上セクション ======== */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-[0.15em] text-foreground">売上</h3>
              {salesTotal > 0 && (
                <span className="text-sm font-black text-primary">
                  {`\u00A5${salesTotal.toLocaleString("ja-JP")}`}
                </span>
              )}
            </div>

            <div className="border border-border bg-card divide-y divide-border">
              {SALES_FIELDS.map((field) => {
                const taxInc = parseInt(amounts[field.item_name] ?? "0", 10) || 0;
                const taxExc = Math.floor(taxInc / 1.1);
                return (
                  <div key={field.item_name} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-4">
                    <label className="text-sm font-medium text-foreground tracking-wider sm:flex-1 sm:min-w-0">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                    </label>
                    <div className="w-full sm:w-40 sm:shrink-0 flex flex-col gap-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{"\u00A5"}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amounts[field.item_name] ?? ""}
                          onChange={(e) => setAmount(field.item_name, e.target.value)}
                          placeholder="0"
                          className="w-full bg-input border border-border text-foreground text-base sm:text-sm pl-7 pr-3 py-3 sm:py-2.5 focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      {taxInc > 0 && (
                        <p className="text-xs text-muted-foreground/70 tracking-wider text-right">
                          税抜 ¥{taxExc.toLocaleString("ja-JP")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ======== 運営費用セクション ======== */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-[0.15em] text-foreground">運営費用</h3>
              {expenseTotal > 0 && (
                <span className="text-sm font-black text-primary">
                  {`\u00A5${expenseTotal.toLocaleString("ja-JP")}`}
                </span>
              )}
            </div>

            <div className="border border-border bg-card divide-y divide-border">
              {EXPENSE_FIELDS.map((field, idx) => {
                const groupHeader = EXPENSE_GROUP_HEADERS[idx];
                const isAuto = field.autoCalc;
                const hasFile = !!files[field.item_name];
                const mFiles = multiFiles[field.item_name] ?? [];

                return (
                  <div key={field.item_name}>
                    {/* 中項目グループヘッダー */}
                    {groupHeader && (
                      <div className={`px-4 py-2.5 ${groupHeader.color}`}>
                        <span className="text-xs font-bold tracking-[0.15em] uppercase">
                          {groupHeader.label}
                        </span>
                      </div>
                    )}

                    <div className={`px-4 py-4 ${field.indent ? "sm:pl-8 pl-4" : ""}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <label className="text-sm font-medium text-foreground tracking-wider sm:flex-1 sm:min-w-0">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                        </label>
                        <div className="flex items-start gap-2 w-full sm:w-auto sm:shrink-0">

                        {isAuto ? (() => {
                          const taxExcAuto = salesTotal > 0 ? Math.floor(autoCalcValue / 1.1) : 0;
                          return (
                            // 自動計算（読み取り専用）
                            <div className="flex-1 sm:flex-none sm:w-40 flex flex-col gap-1">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{"\u00A5"}</span>
                                <input
                                  type="text"
                                  readOnly
                                  value={salesTotal > 0 ? autoCalcValue.toLocaleString("ja-JP") : "0"}
                                  className="w-full bg-secondary border border-border text-muted-foreground text-base sm:text-sm pl-7 pr-3 py-3 sm:py-2.5 cursor-not-allowed"
                                />
                              </div>
                              {salesTotal > 0 && (
                                <p className="text-xs text-muted-foreground/70 tracking-wider text-right">
                                  税抜 ¥{taxExcAuto.toLocaleString("ja-JP")}
                                </p>
                              )}
                            </div>
                          );
                        })() : (() => {
                          const taxInc = parseInt(amounts[field.item_name] ?? "0", 10) || 0;
                          const taxExc = Math.floor(taxInc / 1.1);
                          return (
                            // 通常入力
                            <div className="flex-1 sm:flex-none sm:w-40 flex flex-col gap-1">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{"\u00A5"}</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={amounts[field.item_name] ?? ""}
                                  onChange={(e) => setAmount(field.item_name, e.target.value)}
                                  placeholder="0"
                                  className="w-full bg-input border border-border text-foreground text-base sm:text-sm pl-7 pr-3 py-3 sm:py-2.5 focus:outline-none focus:border-primary transition-colors"
                                />
                              </div>
                              {taxInc > 0 && (
                                <p className="text-xs text-muted-foreground/70 tracking-wider text-right">
                                  税抜 ¥{taxExc.toLocaleString("ja-JP")}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {/* ファイル添付（単一） */}
                        {field.allowFile && !field.multiFile && (
                          <>
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[field.item_name]?.click()}
                              className={`shrink-0 w-9 h-9 flex items-center justify-center border transition-colors ${hasFile
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                                }`}
                              title={hasFile ? files[field.item_name].name : field.csvCalc ? "CSVアップロード" : "ファイル添付"}
                            >
                              {hasFile ? <Check className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                            </button>
                            <input
                              ref={(el) => { fileInputRefs.current[field.item_name] = el; }}
                              type="file"
                              accept={field.csvCalc ? ".csv,text/csv" : "image/*,application/pdf,.csv"}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setFiles((prev) => ({ ...prev, [field.item_name]: f }));
                                  if (field.csvCalc && f.name.endsWith(".csv")) {
                                    void handleHonbuCsv(f);
                                  }
                                }
                              }}
                            />
                          </>
                        )}

                        {/* ファイル添付（複数） */}
                        {field.allowFile && field.multiFile && (
                          <>
                            {/* カメラボタン → アクションシート表示 */}
                            <button
                              type="button"
                              onClick={() => setActionSheetField(field.item_name)}
                              className={`shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center border transition-colors ${mFiles.length > 0
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                                }`}
                              title="ファイルを追加"
                            >
                              <Camera className="w-5 h-5 sm:w-4 sm:h-4" />
                            </button>
                            {/* 写真を撮る（カメラ起動） */}
                            <input
                              ref={(el) => { fileInputRefs.current[`${field.item_name}_capture`] = el; }}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const selected = Array.from(e.target.files ?? []);
                                if (selected.length > 0) {
                                  setMultiFiles((prev) => ({
                                    ...prev,
                                    [field.item_name]: [...(prev[field.item_name] ?? []), ...selected],
                                  }));
                                }
                                e.target.value = "";
                              }}
                            />
                            {/* カメラロールから選択 */}
                            <input
                              ref={(el) => { fileInputRefs.current[`${field.item_name}_gallery`] = el; }}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const selected = Array.from(e.target.files ?? []);
                                if (selected.length > 0) {
                                  setMultiFiles((prev) => ({
                                    ...prev,
                                    [field.item_name]: [...(prev[field.item_name] ?? []), ...selected],
                                  }));
                                }
                                e.target.value = "";
                              }}
                            />
                            {/* クリップ/PDF・CSVボタン */}
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[`${field.item_name}_doc`]?.click()}
                              className={`shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center border transition-colors ${mFiles.some(f => f.type === "application/pdf" || f.name.endsWith(".csv"))
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                                }`}
                              title="PDF・CSVを添付"
                            >
                              <Paperclip className="w-5 h-5 sm:w-4 sm:h-4" />
                            </button>
                            <input
                              ref={(el) => { fileInputRefs.current[`${field.item_name}_doc`] = el; }}
                              type="file"
                              accept="application/pdf,.csv,text/csv"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const selected = Array.from(e.target.files ?? []);
                                if (selected.length > 0) {
                                  setMultiFiles((prev) => ({
                                    ...prev,
                                    [field.item_name]: [...(prev[field.item_name] ?? []), ...selected],
                                  }));
                                }
                              }}
                            />
                            {/* Amazon/Cainz CSV アップロードボタン */}
                            {field.amazonCsv && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current[`${field.item_name}_csv`]?.click()}
                                  className={`shrink-0 w-9 h-9 flex items-center justify-center border transition-colors ${amazonCsvAmount > 0
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/50"
                                    }`}
                                  title="Amazon/Cainz等のCSVをアップロード"
                                >
                                  <Paperclip className="w-4 h-4" />
                                </button>
                                <input
                                  ref={(el) => { fileInputRefs.current[`${field.item_name}_csv`] = el; }}
                                  type="file"
                                  accept=".csv,text/csv"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleAmazonCsv(f);
                                  }}
                                />
                              </>
                            )}
                          </>
                        )}
                        </div>{/* end input+buttons wrapper */}
                      </div>

                      {/* 複数ファイルのプレビューリスト */}
                      {field.multiFile && mFiles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-0">
                          {mFiles.map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-secondary border border-border px-2 py-1 text-[10px] text-muted-foreground tracking-wider">
                              <button
                                type="button"
                                onClick={() => openPreview(mFiles)}
                                className="hover:text-primary transition-colors text-left max-w-[120px] truncate"
                                title="クリックして確認"
                              >
                                {f.name.length > 15 ? `${f.name.slice(0, 12)}...` : f.name}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMultiFiles((prev) => ({
                                    ...prev,
                                    [field.item_name]: (prev[field.item_name] ?? []).filter((_, j) => j !== i),
                                  }))
                                }
                                className="text-muted-foreground hover:text-destructive ml-0.5 shrink-0"
                                title="削除"
                              >
                                <XIcon className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          {mFiles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => openPreview(mFiles)}
                              className="text-[10px] text-primary underline tracking-wider hover:text-primary/70 transition-colors"
                            >
                              全て確認 ({mFiles.length}件)
                            </button>
                          )}
                        </div>
                      )}

                      {/* 下書き復元: アップロード済みファイルのURL表示 */}
                      {uploadedUrls[field.item_name] && mFiles.length === 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {uploadedUrls[field.item_name].split("\n").filter(Boolean).map((url, i) => {
                            const label = url.split("/").pop()?.split("?")[0] ?? `ファイル${i + 1}`;
                            const shortLabel = decodeURIComponent(label).slice(-20);
                            return (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 text-primary px-2 py-1 text-[10px] tracking-wider hover:bg-primary/20 transition-colors"
                                title="Driveで開く"
                              >
                                <Check className="w-2.5 h-2.5 shrink-0" />
                                {shortLabel}
                              </a>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setUploadedUrls((prev) => { const n = { ...prev }; delete n[field.item_name]; return n; })}
                            className="text-[10px] text-muted-foreground/60 hover:text-destructive tracking-wider transition-colors"
                            title="保存済みファイルをクリア（再アップロード可能）"
                          >
                            クリア
                          </button>
                        </div>
                      )}

                      {/* Amazon/Cainz CSV 集計内訳 */}
                      {field.amazonCsv && amazonCsvAmount > 0 && (
                        <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-2">
                          <span className="text-[11px] text-blue-700 tracking-wider">
                            CSV集計（Amazon/Cainz等）
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-blue-700">¥{amazonCsvAmount.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const manual = parseInt(amounts[field.item_name] ?? "0", 10) || 0;
                                setAmounts((prev) => ({ ...prev, [field.item_name]: String(manual - amazonCsvAmount) }));
                                setAmazonCsvAmount(0);
                              }}
                              className="text-blue-400 hover:text-blue-700 transition-colors"
                              title="CSV集計を取り消す"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 本部スタッフ一覧（CSVアップロード後） */}
                      {field.csvCalc && honbuStaffs.length > 0 && (
                        <div className="mt-2 border border-border overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto_auto] bg-secondary border-b border-border">
                            <span className="px-3 py-1.5 text-[10px] text-muted-foreground tracking-widest uppercase font-bold">氏名</span>
                            <span className="px-3 py-1.5 text-[10px] text-muted-foreground tracking-widest uppercase font-bold">労働時間</span>
                            <span className="px-3 py-1.5 text-[10px] text-muted-foreground tracking-widest uppercase font-bold">除外</span>
                          </div>
                          {honbuStaffs.map((staff, i) => {
                            const hours = Math.round((staff.minutes / 60) * 100) / 100;
                            return (
                              <div
                                key={i}
                                className={`grid grid-cols-[1fr_auto_auto] border-b last:border-b-0 border-border transition-colors ${!staff.enabled ? "opacity-40 bg-secondary/60" : ""}`}
                              >
                                <span className="px-3 py-2 text-xs text-foreground">{staff.name}</span>
                                <span className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{hours}h</span>
                                <button
                                  type="button"
                                  onClick={() => toggleHonbuStaff(i)}
                                  className={`px-3 py-2 flex items-center justify-center transition-colors ${staff.enabled ? "text-red-500 hover:text-red-700" : "text-muted-foreground hover:text-foreground"}`}
                                  title={staff.enabled ? "計算から除外" : "計算に戻す"}
                                >
                                  <XIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ======== 合計 + アクション ======== */}
          <section className="border-t border-border pt-6 space-y-4">
            {/* 下書き復元バナー */}
            {draftInfo && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 px-4 py-3">
                <p className="text-xs text-amber-800 tracking-wide">
                  <span className="font-bold">下書きが見つかりました</span>（{draftInfo.saved_at}）
                </p>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={restoreDraft} className="bg-amber-500 text-white text-[10px] tracking-widest uppercase font-bold px-3 py-1.5 hover:bg-amber-600 transition-colors">
                    復元する
                  </button>
                  <button type="button" onClick={() => void discardDraft()} className="border border-amber-400 text-amber-700 text-[10px] tracking-widest uppercase font-bold px-3 py-1.5 hover:bg-amber-100 transition-colors">
                    破棄
                  </button>
                </div>
              </div>
            )}
            {/* 売上合計（��込・税抜） */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground tracking-wider">売上合計（税込）</span>
                <span className="text-lg font-black text-primary">{`\u00A5${salesTotal.toLocaleString("ja-JP")}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70 tracking-wider">売上合計（税抜）</span>
                <span className="text-sm font-bold text-muted-foreground">{`\u00A5${Math.floor(salesTotal / 1.1).toLocaleString("ja-JP")}`}</span>
              </div>
            </div>
            {/* 運営費用合計（税込・税抜） */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground tracking-wider">運営費用合計（税込）</span>
                <span className="text-lg font-black text-primary">{`\u00A5${expenseTotal.toLocaleString("ja-JP")}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70 tracking-wider">運営費用合計（税抜）</span>
                <span className="text-sm font-bold text-muted-foreground">{`\u00A5${Math.floor(expenseTotal / 1.1).toLocaleString("ja-JP")}`}</span>
              </div>
            </div>
            {/* 振込金額（税込・税抜） */}
            <div className="pt-2 border-t border-border space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground tracking-wider">振込金額（税込）</span>
                <span className={`text-xl font-black tracking-wider ${salesTotal - expenseTotal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {`\u00A5${(salesTotal - expenseTotal).toLocaleString("ja-JP")}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70 tracking-wider">振込金額（税抜）</span>
                <span className={`text-sm font-bold ${salesTotal - expenseTotal >= 0 ? "text-emerald-600/70" : "text-red-400"}`}>
                  {`\u00A5${Math.floor((salesTotal - expenseTotal) / 1.1).toLocaleString("ja-JP")}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <button
                type="button"
                onClick={handleBack}
                className="border border-border py-3.5 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={() => void handleDraftSave()}
                disabled={isSavingDraft}
                className="border border-primary text-primary py-3.5 text-xs tracking-widest uppercase font-bold hover:bg-primary/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                下書き保存
              </button>
              <button
                type="submit"
                className="bg-primary text-primary-foreground py-3.5 text-xs tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={isSubmitting}
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
          </section>
        </form>
      </div>

      {/* カメラアクションシート */}
      {actionSheetField && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50"
          onClick={() => setActionSheetField(null)}
        >
          <div
            className="bg-background w-full max-w-lg mb-0 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-2 text-center border-b border-border">
              <p className="text-xs text-muted-foreground tracking-[0.2em] uppercase">ファイルの追加方法を選択してください</p>
            </div>
            <div className="flex flex-col divide-y divide-border">
              <button
                type="button"
                className="w-full py-4 text-base font-medium text-foreground tracking-wider hover:bg-secondary transition-colors"
                onClick={() => {
                  fileInputRefs.current[`${actionSheetField}_capture`]?.click();
                  setActionSheetField(null);
                }}
              >
                写真を撮る
              </button>
              <button
                type="button"
                className="w-full py-4 text-base font-medium text-foreground tracking-wider hover:bg-secondary transition-colors"
                onClick={() => {
                  fileInputRefs.current[`${actionSheetField}_gallery`]?.click();
                  setActionSheetField(null);
                }}
              >
                カメラロールから選択
              </button>
              <button
                type="button"
                className="w-full py-4 text-base font-medium text-foreground tracking-wider hover:bg-secondary transition-colors"
                onClick={() => {
                  fileInputRefs.current[`${actionSheetField}_doc`]?.click();
                  setActionSheetField(null);
                }}
              >
                ファイルから選択
              </button>
            </div>
            <div className="border-t-4 border-border">
              <button
                type="button"
                className="w-full py-4 text-base font-bold text-muted-foreground tracking-wider hover:bg-secondary transition-colors"
                onClick={() => setActionSheetField(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ファイルプレビューダイアログ */}
      {previewFiles && previewFiles.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={closePreview}
        >
          <div
            className="bg-background border border-border w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-foreground">
                添付ファイル確認 ({previewFiles.length}件)
              </p>
              <button
                type="button"
                onClick={closePreview}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {previewFiles.map((f, i) => (
                <div key={i} className="border border-border p-3">
                  <p className="text-[11px] text-muted-foreground tracking-wider mb-2 truncate">
                    {i + 1}. {f.name}
                    <span className="ml-2 text-[10px] text-muted-foreground/60">
                      ({(f.size / 1024).toFixed(1)} KB)
                    </span>
                  </p>
                  {f.type === "application/pdf" && previewUrls[i] ? (
                    <iframe
                      src={previewUrls[i]}
                      title={f.name}
                      className="w-full h-72 border-0 bg-secondary"
                    />
                  ) : f.type.startsWith("image/") && previewUrls[i] ? (
                    <img
                      src={previewUrls[i]}
                      alt={f.name}
                      className="w-full max-h-64 object-contain bg-secondary"
                    />
                  ) : (
                    <div className="flex items-center gap-3 bg-secondary px-4 py-6 justify-center">
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground tracking-wider">{f.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
