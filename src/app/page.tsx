"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar, ActiveTab } from "@/components/Navbar";
import { DashboardTab } from "@/components/DashboardTab";
import { OrdersTab } from "@/components/OrdersTab";
import { InventoryTab } from "@/components/InventoryTab";
import { ReceivablesTab } from "@/components/ReceivablesTab";
import { PayablesTab } from "@/components/PayablesTab";
import { ExpensesTab } from "@/components/ExpensesTab";
import { CashTab } from "@/components/CashTab";
import { InvoiceTab } from "@/components/InvoiceTab";
import { ReportsTab } from "@/components/ReportsTab";
import { BackupTab } from "@/components/BackupTab";
import { TrashTab } from "@/components/TrashTab";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [isOwnerRole, setIsOwnerRole] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
      setError(null);
    } catch (err: any) {
      console.error("Fetch state error:", err);
      setError(err.message || "فشل الاتصال بقاعدة البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleQuickAdjust = async (method: "cash" | "wallet", amount: number) => {
    try {
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: amount > 0 ? "in" : "out",
          method,
          amount: Math.abs(amount),
          date: new Date().toISOString().slice(0, 10),
          source: "تعديل رصيد يدوي سريع",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchState();
    } catch (err: any) {
      alert("فشل تعديل الرصيد: " + err.message);
    }
  };

  const handleExit = () => {
    alert("✅ اتحفظت كل البيانات بنجاح بقاعدة البيانات.\nتقدر تقفل الصفحة براحتك دلوقتي.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-ink">
        <div className="w-14 h-14 rounded-2xl bg-accent-soft border border-accent/20 flex items-center justify-center font-cairo font-black text-accent-dark text-2xl shadow-sm mb-4 animate-bounce">
          ب
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-muted">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span>جاري تحميل بيانات متجر بكيزة هانم...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-surface border border-danger/30 rounded-2xl p-6 max-w-sm shadow-warm space-y-3">
          <span className="text-2xl block">⚠️</span>
          <h2 className="text-base font-black text-ink">حدث خطأ في النظام</h2>
          <p className="text-xs text-muted">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchState();
            }}
            className="w-full bg-accent text-white font-bold py-2 rounded-xl text-xs hover:bg-accent-dark transition"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Sticky Modern Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOwnerRole={isOwnerRole}
        setIsOwnerRole={setIsOwnerRole}
        onExit={handleExit}
      />

      {/* Main Tab Content */}
      <main className="max-w-[1200px] w-full mx-auto px-4 py-6 flex-1">
        {activeTab === "dashboard" && (
          <DashboardTab
            data={data}
            isOwnerRole={isOwnerRole}
            onQuickAdjust={handleQuickAdjust}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === "orders" && (
          <OrdersTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "inventory" && (
          <InventoryTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "receivable" && (
          <ReceivablesTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "payable" && (
          <PayablesTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "expenses" && (
          <ExpensesTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "cash" && (
          <CashTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "invoice" && <InvoiceTab data={data} />}

        {activeTab === "reports" && <ReportsTab data={data} />}

        {activeTab === "backup" && (
          <BackupTab data={data} onRefresh={fetchState} />
        )}

        {activeTab === "trash" && (
          <TrashTab data={data} onRefresh={fetchState} />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-muted text-xs py-6 border-t border-border/60 bg-surface/50 no-print">
        بكيزة هانم — إدارة الأعمال المتكاملة · البيانات محفوظة ومحمية محلياً بقاعدة بيانات موثوقة
      </footer>
    </div>
  );
}
