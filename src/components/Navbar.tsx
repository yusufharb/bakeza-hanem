"use client";

import React from "react";
import { formatArabicDate } from "@/lib/utils";
import { LogOut, ShieldCheck, User } from "lucide-react";

export type ActiveTab =
  | "dashboard"
  | "orders"
  | "inventory"
  | "receivable"
  | "payable"
  | "expenses"
  | "cash"
  | "invoice"
  | "reports"
  | "backup"
  | "trash";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOwnerRole: boolean;
  setIsOwnerRole: (val: boolean) => void;
  onExit: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isOwnerRole,
  setIsOwnerRole,
  onExit,
}) => {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "dashboard", label: "الرئيسية" },
    { id: "orders", label: "الأوردرات" },
    { id: "inventory", label: "المخزون" },
    { id: "receivable", label: "الفلوس اللي لينا" },
    { id: "payable", label: "الفلوس اللي علينا" },
    { id: "expenses", label: "مصروفات" },
    { id: "cash", label: "الخزنة" },
    { id: "invoice", label: "فاتورة" },
    { id: "reports", label: "تقارير" },
    { id: "backup", label: "نسخة احتياطية" },
    { id: "trash", label: "سلة المحذوفات" },
  ];

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-30 shadow-sm no-print">
      <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/20 flex items-center justify-center font-cairo font-black text-accent-dark text-xl shadow-sm">
            ب
          </div>
          <div>
            <h1 className="text-lg font-black text-ink m-0 leading-tight">بكيزة هانم</h1>
            <span className="text-xs text-muted font-medium">{formatArabicDate()}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 flex-wrap overflow-x-auto py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-ink text-white shadow-sm"
                    : "text-muted hover:bg-accent-soft hover:text-accent-dark"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Tools: Role toggle & Exit */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOwnerRole(!isOwnerRole)}
            title={isOwnerRole ? "وضع المدير (عرض كافة الأرقام)" : "وضع الموظف (إخفاء رأس المال والأرباح)"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
              isOwnerRole
                ? "bg-sage-soft text-sage border-sage/30 hover:bg-sage/10"
                : "bg-accent-soft text-accent-dark border-accent/30 hover:bg-accent/10"
            }`}
          >
            {isOwnerRole ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{isOwnerRole ? "المدير" : "الموظف"}</span>
          </button>

          <button
            onClick={onExit}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold border border-border text-muted hover:bg-bg hover:text-danger transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
};
