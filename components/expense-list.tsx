"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Zap, Droplets, Package, Clock, RefreshCw, Plus, Trash2, ChevronDown, ExternalLink, TrendingUp, Building2, FileEdit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ExpenseRow } from "@/lib/supabase-db";
import { FolderPdfPrint } from "@/components/folder-pdf-print";
import { useExpensesRealtime } from "@/hooks/use-expenses-realtime";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  売上: <TrendingUp className="w-3 h-3" />,
  運営費用: <Building2 className="w-3 h-3" />,
  電気料金: <Zap className="w-3 h-3" />,
  水道料金: <Droplets className="w-3 h-3" />,
  備品: <Package className="w-3 h-3" />,
  勤怠: <Clock className="w-3 h-3" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  売上: "text-emerald-500 border-emerald-500/40",
  運営費用: "text-orange-500 border-orange-500/40",
  電気料金: "text-yellow-500 border-yellow-500/40",
  水道料金: "text-sky-500 border-sky-500/40",
  備品: "text-emerald-500 border-emerald-500/40",
  勤怠: "text-accent border-accent/40",
};

interface ExpenseListProps {
  onAddToFolder?: (folderName: string) => void;
  onOpenDraft?: (folderName: string) => void;
}

export function ExpenseList({ onAddToFolder, onOpenDraft }: ExpenseListProps) {
  const { data, error, isLoading, mutate } = useSWR<{ expenses: ExpenseRow[] }>(
    "/api/expenses",
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: draftData, mutate: mutateDrafts } = useSWR<{ drafts: { folder_name: string; saved_at: string }[] }>(
    "/api/drafts/list",
    fetcher,
    { refreshInterval: 0 }
  );

  // Supabase Realtime: 他デバイスの変更を即時反映
  const handleRealtime = useCallback((event: "expenses" | "drafts" | "all") => {
    if (event === "expenses" || event === "all") mutate();
    if (event === "drafts" || event === "all") mutateDrafts();
  }, [mutate, mutateDrafts]);
  useExpensesRealtime(handleRealtime);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingDraft, setDeletingDraft] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  async function handleDeleteFolder(folderName: string) {
    if (!confirm(`「${folderName}」フォルダーを全て削除しますか？\nこの操作は取り消せません。`)) return;
    setDeletingFolder(folderName);
    try {
      const res = await fetch("/api/expenses/delete-folder", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_name: folderName }),
      });
      if (!res.ok) throw new Error();
      mutate();
      mutateDrafts();
      toast.success(`「${folderName}」を削除しました`);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeletingFolder(null);
    }
  }

  async function handleDeleteDraft(folderName: string) {
    setDeletingDraft(folderName);
    try {
      const res = await fetch(`/api/drafts/delete?folder_name=${encodeURIComponent(folderName)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      mutate();
      mutateDrafts();
      toast.success("下書きを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeletingDraft(null);
    }
  }
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const expenses = data?.expenses ?? [];
  const allDrafts = draftData?.drafts ?? [];
  const draftFolders = new Set(allDrafts.map((d) => d.folder_name));

  // 経費登録済みフォルダー名のセット
  const registeredFolderNames = new Set(expenses.map((e) => e.folder_name || "未分類"));

  // 下書きのみ（経費未登録）のフォルダー一覧
  const draftOnlyFolders = allDrafts.filter((d) => !registeredFolderNames.has(d.folder_name));

  function toggleFolder(folder: string) {
    setOpenFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  }

  async function handleDelete(id: string, itemName: string) {
    if (!confirm(`「${itemName}」を削除しますか？`)) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/expenses/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "削除に失敗しました");
      toast.success("経費を削除しました");
      mutate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-8 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground tracking-widest uppercase">データの取得に失敗しました</p>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 border border-border px-4 py-2 text-xs tracking-widest uppercase text-foreground hover:border-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          再読み込み
        </button>
      </div>
    );
  }

  if (expenses.length === 0 && draftOnlyFolders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center px-4">
        <div className="w-12 h-px bg-primary mx-auto mb-2" />
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">No Expenses Found</p>
        <p className="text-sm text-muted-foreground/60">「新規登録」から経費を追加してください</p>
      </div>
    );
  }

  const grouped = expenses.reduce<Record<string, ExpenseRow[]>>((acc, e) => {
    const key = e.folder_name || "未分類";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const sortedFolderEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "ja"));

  return (
    <div className="pb-12 space-y-4 px-4 md:px-8 mt-6">
      {/* 下書きのみフォルダー（経費未登録） */}
      {draftOnlyFolders.map((draft) => (
        <div key={`draft-${draft.folder_name}`} className="border border-amber-300 overflow-hidden">
          <div className="flex flex-col gap-2 px-4 py-3 bg-amber-50 sm:flex-row sm:items-center sm:justify-between">
            {/* 上段: アイコン＋フォルダー名＋バッジ */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-1 h-4 bg-amber-400 shrink-0" />
              <span className="text-sm font-bold text-foreground tracking-wider truncate max-w-[160px] sm:max-w-none">
                {draft.folder_name}
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-700 text-[9px] font-bold tracking-widest px-1.5 py-0.5">
                <FileEdit className="w-2.5 h-2.5" />
                下書き
              </span>
              <span className="text-[10px] text-amber-600 tracking-wider shrink-0">{formatDate(draft.saved_at)}</span>
            </div>
            {/* 下段: ボタン群 */}
            <div className="flex items-center gap-2 shrink-0">
              {onOpenDraft && (
                <button
                  type="button"
                  onClick={() => onOpenDraft(draft.folder_name)}
                  className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 text-[10px] tracking-widest uppercase font-bold hover:bg-amber-600 transition-colors"
                >
                  <FileEdit className="w-3 h-3" />
                  続きを入力
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDeleteDraft(draft.folder_name)}
                disabled={deletingDraft === draft.folder_name}
                className="w-7 h-7 flex items-center justify-center border border-amber-300 text-amber-500 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                title="下書きを削除"
              >
                {deletingDraft === draft.folder_name ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
      {sortedFolderEntries
        .map(([folder, items]) => {
          const salesTotal = items.filter((e) => e.category === "売上").reduce((s, e) => s + Number(e.amount), 0);
          const expenseTotal = items.filter((e) => e.category === "運営費用").reduce((s, e) => s + Number(e.amount), 0);
          const folderBalance = salesTotal - expenseTotal;
          const isNegative = folderBalance < 0;
          const isOpen = openFolders[folder] ?? false;

          return (
            <div key={folder} className="border border-border overflow-hidden">
              {/* Folder header: タップで展開/折りたたみ */}
              <div className="flex flex-col gap-2 px-4 py-3 bg-secondary sm:flex-row sm:items-center sm:justify-between">
                {/* 上段左: フォルダー名＋バッジ（タップで開閉） */}
                <button
                  type="button"
                  onClick={() => toggleFolder(folder)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`folder-${folder}`}
                >
                  <div className="w-1 h-4 bg-primary shrink-0" />
                  <span className="text-sm font-bold text-foreground tracking-wider truncate max-w-[160px] sm:max-w-none">
                    {folder}
                  </span>
                  {draftFolders.has(folder) && (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-700 text-[9px] font-bold tracking-widest px-1.5 py-0.5">
                      <FileEdit className="w-2.5 h-2.5" />
                      下書き
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* 下段右: 合計＋ボタン群 */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className={`text-sm font-black tracking-wider ${isNegative ? "text-destructive" : "text-primary"}`}>
                    {isNegative ? "-" : ""}¥{Math.abs(folderBalance).toLocaleString()}
                  </span>
                  <FolderPdfPrint folderName={folder} items={items} />
                  {draftFolders.has(folder) && onOpenDraft && (
                    <button
                      type="button"
                      onClick={() => onOpenDraft(folder)}
                      className="flex items-center gap-1 border border-amber-400 text-amber-700 bg-amber-50 px-2.5 py-1 text-[10px] tracking-widest uppercase font-bold hover:bg-amber-100 transition-colors"
                      title="下書きの続きから入力"
                    >
                      <FileEdit className="w-3 h-3" />
                      続きを入力
                    </button>
                  )}
                  {onAddToFolder && (
                    <button
                      type="button"
                      onClick={() => onAddToFolder(folder)}
                      className="flex items-center gap-1 border border-primary text-primary px-2.5 py-1 text-[10px] tracking-widest uppercase font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                      title="このフォルダに経費を追加"
                    >
                      <Plus className="w-3 h-3" />
                      追加
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteFolder(folder)}
                    disabled={deletingFolder === folder}
                    className="w-7 h-7 flex items-center justify-center border border-border text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                    title="フォルダーごと削除"
                  >
                    {deletingFolder === folder ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Items: アコーディオン本体 */}
              {isOpen && (
                <div id={`folder-${folder}`} className="divide-y divide-border border-t border-border">
                  {items.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/50 transition-colors"
                    >
                      <span
                        className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-semibold tracking-widest shrink-0 ${
                          CATEGORY_COLORS[expense.category] ?? "text-foreground border-border"
                        }`}
                      >
                        {CATEGORY_ICONS[expense.category]}
                        {expense.category}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate tracking-wide">
                          {expense.item_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground tracking-wider mt-0.5">
                          {formatDate(expense.datetime)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-foreground shrink-0 tracking-wider">
                        ¥{expense.amount.toLocaleString()}
                      </span>
                      {/* Drive URL link */}
                      {expense.datafile && (
                        <a
                          href={expense.datafile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          title="領収書を確認"
                          aria-label="Google Drive で領収書を確認"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(expense.id, expense.item_name)}
                        disabled={deletingId === expense.id}
                        className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        title="削除"
                        aria-label={`${expense.item_name}を削除`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
