import { createClient } from "@supabase/supabase-js";

// サービスロールキーを使用（サーバーサイド専用）
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ExpenseRow {
  id: string;
  datetime: string;
  folder_name: string;
  category: string;
  item_name: string;
  amount: number | string;
  datafile: string;
}

export interface DraftRow {
  draft_id: string;
  saved_at: string;
  folder_name: string;
  amounts_json: string;
  files_json: string;
}

/** 全経費データを取得 */
export async function getExpenses(): Promise<ExpenseRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("datetime", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    datetime: row.datetime
      ? new Date(row.datetime)
          .toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
          .replace(/\//g, "-")
      : "",
    folder_name: row.folder_name,
    category: row.category,
    item_name: row.item_name,
    amount: row.amount,
    datafile: row.datafile ?? "",
  }));
}

/** 経費を1件追加 */
export async function appendExpense(
  data: Omit<ExpenseRow, "id" | "datetime">
): Promise<void> {
  const supabase = getAdminClient();
  const id = `EXP-${Date.now()}`;

  const { error } = await supabase.from("expenses").insert({
    id,
    folder_name: data.folder_name,
    category: data.category,
    item_name: data.item_name,
    amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
    datafile: data.datafile ?? "",
  });

  if (error) throw new Error(error.message);
}

/** folder_name に一致する経費を全削除 */
export async function deleteFolder(folderName: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("folder_name", folderName);

  if (error) throw new Error(error.message);
}

/** IDで経費を1件削除 */
export async function deleteExpense(id: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** 下書きを保存（同一 folder_name は upsert） */
export async function saveDraft(
  folderName: string,
  amounts: Record<string, string>,
  uploadedUrls: Record<string, string> = {}
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("drafts").upsert(
    {
      folder_name: folderName,
      amounts_json: amounts,
      files_json: uploadedUrls,
      saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "folder_name" }
  );

  if (error) throw new Error(error.message);
}

/** folder_name で下書きを1件取得 */
export async function loadDraft(folderName: string): Promise<DraftRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("folder_name", folderName)
    .single();

  if (error || !data) return null;

  return {
    draft_id: data.id,
    saved_at: data.saved_at,
    folder_name: data.folder_name,
    amounts_json: JSON.stringify(data.amounts_json ?? {}),
    files_json: JSON.stringify(data.files_json ?? {}),
  };
}

/** 全下書き一覧を取得 */
export async function listDrafts(): Promise<DraftRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .order("saved_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    draft_id: row.id,
    saved_at: row.saved_at,
    folder_name: row.folder_name,
    amounts_json: JSON.stringify(row.amounts_json ?? {}),
    files_json: JSON.stringify(row.files_json ?? {}),
  }));
}

/** folder_name で下書きを削除 */
export async function deleteDraftByFolder(folderName: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("drafts")
    .delete()
    .eq("folder_name", folderName);

  if (error) throw new Error(error.message);
}
