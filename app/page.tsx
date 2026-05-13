"use client";

import { useState } from "react";
import { SWRConfig } from "swr";
import { Header } from "@/components/header";
import { ExpenseList } from "@/components/expense-list";
import { NewExpenseDrawer } from "@/components/new-expense-drawer";

export default function HomePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [targetFolder, setTargetFolder] = useState<string | undefined>(undefined);

  function handleRegistered() {
    setRefreshKey((k) => k + 1);
  }

  function openNewExpense() {
    setTargetFolder(undefined);
    setDrawerOpen(true);
  }

  function openAddToFolder(folderName: string) {
    setTargetFolder(folderName);
    setDrawerOpen(true);
  }

  function openDraft(folderName: string) {
    setTargetFolder(folderName);
    setDrawerOpen(true);
  }

  return (
    <SWRConfig value={{}}>
      <div className="min-h-screen bg-background">
        <Header onNewExpense={openNewExpense} />
        <main className="max-w-3xl mx-auto">
          <ExpenseList key={refreshKey} onAddToFolder={openAddToFolder} onOpenDraft={openDraft} />
        </main>
        <footer className="border-t border-border py-6 text-center">
          <p className="text-[10px] tracking-[0.4em] text-muted-foreground uppercase">
            Expense Management System
          </p>
        </footer>
        <NewExpenseDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onRegistered={handleRegistered}
          initialFolderName={targetFolder}
        />
      </div>
    </SWRConfig>
  );
}
