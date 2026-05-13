"use client";

import { Zap, Droplets, Package, Clock } from "lucide-react";

export type ExpenseCategory = "電気料金" | "水道料金" | "備品" | "勤怠";

interface CategoryConfig {
  key: ExpenseCategory;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  accent: string;
  accentBorder: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    key: "電気料金",
    label: "電気料金",
    sublabel: "ELECTRICITY",
    icon: <Zap className="w-6 h-6" />,
    accent: "text-yellow-400",
    accentBorder: "hover:border-yellow-400/60",
  },
  {
    key: "水道料金",
    label: "水道料金",
    sublabel: "WATER",
    icon: <Droplets className="w-6 h-6" />,
    accent: "text-sky-400",
    accentBorder: "hover:border-sky-400/60",
  },
  {
    key: "備品",
    label: "備品",
    sublabel: "EQUIPMENT",
    icon: <Package className="w-6 h-6" />,
    accent: "text-emerald-400",
    accentBorder: "hover:border-emerald-400/60",
  },
  {
    key: "勤怠",
    label: "勤怠",
    sublabel: "ATTENDANCE",
    icon: <Clock className="w-6 h-6" />,
    accent: "text-accent",
    accentBorder: "hover:border-accent/60",
  },
];

interface CategorySelectorProps {
  onSelect: (category: ExpenseCategory) => void;
}

export function CategorySelector({ onSelect }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onSelect(cat.key)}
          className={`
            group flex flex-col items-center gap-3 p-5 border border-border bg-card
            transition-all duration-200 cursor-pointer select-none active:scale-95
            hover:bg-secondary ${cat.accentBorder}
          `}
        >
          <span className={`${cat.accent} transition-transform duration-200 group-hover:scale-110`}>
            {cat.icon}
          </span>
          <div className="text-center">
            <p className="font-bold text-sm text-foreground tracking-wider">{cat.label}</p>
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground mt-0.5">{cat.sublabel}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
