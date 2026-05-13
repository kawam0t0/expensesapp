"use client";

import Image from "next/image";
import { Plus } from "lucide-react";

interface HeaderProps {
  onNewExpense: () => void;
}

export function Header({ onNewExpense }: HeaderProps) {
  return (
    <header>
      {/* Full-bleed cinematic hero */}
      <div className="relative h-52 md:h-72 w-full overflow-hidden">
        <Image
          src="/hero-ferrari.jpg"
          alt="経費管理システム"
          fill
          className="object-cover"
          priority
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-background/70" />
        {/* Red bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-primary" />

        {/* Centered title */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
          <p className="tracking-[0.5em] text-[10px] text-muted-foreground uppercase font-light">
            Expense Management System
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-widest text-balance text-center uppercase">
            経費管理
          </h1>
          <div className="w-10 h-px bg-primary" />
        </div>
      </div>

      {/* Navigation bar */}
      <div className="bg-secondary border-b border-border px-4 md:px-8 py-3 flex items-center justify-between">
        <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase font-light">
          登録済み経費一覧
        </p>
        <button
          onClick={onNewExpense}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-xs tracking-[0.15em] uppercase font-semibold px-5 py-2.5 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規登録
        </button>
      </div>
    </header>
  );
}
