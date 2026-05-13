import { google } from "googleapis";
import { Readable } from "stream";

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

/**
 * 親フォルダ内で指定名のサブフォルダを検索し、なければ作成してIDを返す
 */
async function getOrCreateSubfolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const res = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
  });

  const existing = res.data.files?.[0];
  if (existing?.id) {
    console.log("[drive] existing subfolder found:", existing.id);
    return existing.id;
  }

  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });

  console.log("[drive] subfolder created:", created.data.id);
  return created.data.id!;
}

/**
 * Google Drive にファイルをアップロードし、公開URLを返す
 * folderName を指定するとルートフォルダ内にサブフォルダを自動作成して振り分ける
 */
export async function uploadToDrive(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  folderName?: string
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  console.log("[drive] uploadToDrive - fileName:", fileName, "folderName:", folderName);

  const targetFolderId = folderName
    ? await getOrCreateSubfolder(drive, DRIVE_FOLDER_ID, folderName)
    : DRIVE_FOLDER_ID;

  console.log("[drive] targetFolderId:", targetFolderId);

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [targetFolderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink",
  });

  const fileId = res.data.id!;
  const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
  console.log("[drive] uploaded:", viewUrl);
  return viewUrl;
}

