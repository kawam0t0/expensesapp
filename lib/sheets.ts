import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET_NAME = "history";
const DRAFT_SHEET = "drafts";

function getAuth() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY ?? "";
  // ダブルクォートで囲まれている場合を除去してから \n を改行に変換
  const privateKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
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

export async function getExpenses(): Promise<ExpenseRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:G`,
  });
  const rows = res.data.values ?? [];
  return rows.map((row) => ({
    id: row[0] ?? "",
    datetime: row[1] ?? "",
    folder_name: row[2] ?? "",
    category: row[3] ?? "",
    item_name: row[4] ?? "",
    amount: row[5] ?? "",
    datafile: row[6] ?? "",
  }));
}

export async function appendExpense(
  data: Omit<ExpenseRow, "id" | "datetime">
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const now = new Date();
  const datetime = now
    .toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    .replace(/\//g, "-");

  const id = `EXP-${Date.now()}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          id,
          datetime,
          data.folder_name,
          data.category,
          data.item_name,
          data.amount,
          data.datafile ?? "",
        ],
      ],
    },
  });
}

export interface DraftRow {
  draft_id: string;
  saved_at: string;
  folder_name: string;
  amounts_json: string;
  files_json: string; // E列: { [item_name]: "url1\nurl2" } の JSON
}

/** drafts シートに下書きを保存（同一 folder_name は上書き） */
export async function saveDraft(
  folderName: string,
  amounts: Record<string, string>,
  uploadedUrls: Record<string, string> = {}
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 既存の同名下書きを削除
  await deleteDraftByFolder(folderName).catch(() => { });

  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }).replace(/\//g, "-");
  const draftId = `DRF-${Date.now()}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DRAFT_SHEET}!A:E`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[draftId, now, folderName, JSON.stringify(amounts), JSON.stringify(uploadedUrls)]],
    },
  });
}

/** folder_name で下書きを1件取得 */
export async function loadDraft(folderName: string): Promise<DraftRow | null> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DRAFT_SHEET}!A:E`,
  });
  const rows = res.data.values ?? [];
  const found = rows.find((r) => r[2] === folderName);
  if (!found) return null;
  return {
    draft_id: found[0] ?? "",
    saved_at: found[1] ?? "",
    folder_name: found[2] ?? "",
    amounts_json: found[3] ?? "{}",
    files_json: found[4] ?? "{}",
  };
}

/** folder_name で下書きを削除 */
export async function deleteDraftByFolder(folderName: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DRAFT_SHEET}!A:C`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[2] === folderName);
  if (rowIndex === -1) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === DRAFT_SHEET);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        },
      ],
    },
  });
}

/** 全下書き一覧を取得 */
export async function listDrafts(): Promise<DraftRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DRAFT_SHEET}!A:E`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => ({
    draft_id: r[0] ?? "",
    saved_at: r[1] ?? "",
    folder_name: r[2] ?? "",
    amounts_json: r[3] ?? "{}",
    files_json: r[4] ?? "{}",
  }));
}

/** folder_name に一致する経費行を全て削除 */
export async function deleteFolder(folderName: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });
  const rows = res.data.values ?? [];
  // folder_name は C列 (index 2)
  const targetIndexes = rows
    .map((r, i) => ({ i, folder: r[2] ?? "" }))
    .filter(({ folder }) => folder === folderName)
    .map(({ i }) => i)
    .sort((a, b) => b - a); // 後ろから削除して index ズレを防ぐ

  if (targetIndexes.length === 0) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  const sheetId = sheet?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: targetIndexes.map((rowIndex) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      })),
    },
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((row) => row[0] === id);
  if (rowIndex === -1) throw new Error("IDが見つかりません");

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME
  );
  const sheetId = sheet?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}
