import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  return NextResponse.json({
    supabaseUrl: supabaseUrl ? supabaseUrl.slice(0, 40) + "..." : "NOT SET",
    supabaseAnonKey: supabaseAnonKey ? "SET (length: " + supabaseAnonKey.length + ")" : "NOT SET",
    googleDriveEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "NOT SET",
    googleDriveKeySet: process.env.GOOGLE_PRIVATE_KEY ? "SET" : "NOT SET",
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "NOT SET",
  });
}
