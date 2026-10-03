"use client";

import React, { useState } from "react";
import { formatCurrency, daysBetween } from "@/lib/utils";
import { AlertCircle, Clock, Database, PlusCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface DashboardTabProps {
  data: any;
  isOwnerRole: boolean;
  onQuickAdjust: (method: "cash" | "wallet", amount: number) => Promise<void>;
  onNavigateTab: (tab: any) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  data,
  isOwnerRole,
  onQuickAdjust,
  onNavigateTab,
}) => {
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    method: "cash" | "wallet";
    amount: string;
  }>({
    open: false,
    method: "cash",
    amount: "",
  });

  const kpis = data?.kpis || {
    cashBalance: 0,
    walletBalance: 0,
    totalBalance: 0,
    stockValuation: 0,
    totalReceivables: 0,
    totalPayables: 0,
    totalExpenses: 0,
    capital: 0,
  };

  const orders = data?.orders || [];
  const products = data?.products || [];
  const purchases = data?.purchases || [];
  const expenses = data?.expenses || [];
  const lastBackup = data?.settings?.lastBackup || "";

  // Overdue / delayed undelivered orders (10+ days)
  const overdueOrders = orders
    .filter((o: any) => !o.isDelivered && daysBetween(o.orderDate) >= 10)
    .sort((a: any, b: any) => daysBetween(b.orderDate) - daysBetween(a.orderDate));

  // Low stock products
  const lowStockProducts = products.filter(
    (p: any) => p.minStock > 0 && p.stock <= p.minStock
  );

  // Backup reminder (>= 3 days)
  const needBackup =
    (!lastBackup || daysBetween(lastBackup) >= 3) && (orders.length > 0 || purchases.length > 0);

  // Recent activity list
  const recentActivities: { date: string; text: string; type: "order" | "purchase" | "expense" }[] = [];
  orders.slice(0, 10).forEach((o: any) => {
    const total = o.items.reduce((s: number, it: any) => s + it.qty * it.sellPrice, 0);
    recentActivities.push({
      date: o.orderDate,
      text: `أوردر جديد — ${o.customerName} (${formatCurrency(total)} ج.م)`,
      type: "order",
    });
  });
  purchases.slice(0, 5).forEach((p: any) => {
    recentActivities.push({
      date: p.purchaseDate,
      text: `شراء مخزون — ${p.supplier} (${formatCurrency(p.totalCost)} ج.م)`,
      type: "purchase",
    });
  });
  expenses.slice(0, 5).forEach((e: any) => {
    recentActivities.push({
      date: e.date,
      text: `مصروف — ${e.reason} (${formatCurrency(e.amount)} ج.م)`,
      type: "expense",
    });
  });
  recentActivities.sort((a, b) => b.date.localeCompare(a.date));

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(adjustModal.amount);
    if (!val || isNaN(val)) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }
    await onQuickAdjust(adjustModal.method, val);
    setAdjustModal({ open: false, method: "cash", amount: "" });
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Left Column: Cash & Total Balance */}
        <div className="flex flex-col gap-3">
          <div
            onClick={() => setAdjustModal({ open: true, method: "cash", amount: "" })}
            className="bg-surface border border-border rounded-2xl p-4 shadow-warm hover:shadow-warm-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-muted font-bold mb-1.5">
              <span>رصيد النقدية (كاش)</span>
              <span className="text-[11px] text-accent opacity-0 group-hover:opacity-100 transition">
                + تعديل سريع
              </span>
            </div>
            <div className="text-2xl font-black text-ink">
              {formatCurrency(kpis.cashBalance)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>

          <div
            onClick={() => setAdjustModal({ open: true, method: "wallet", amount: "" })}
            className="bg-surface border border-border rounded-2xl p-4 shadow-warm hover:shadow-warm-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-muted font-bold mb-1.5">
              <span>رصيد المحفظة</span>
              <span className="text-[11px] text-accent opacity-0 group-hover:opacity-100 transition">
                + تعديل سريع
              </span>
            </div>
            <div className="text-2xl font-black text-ink">
              {formatCurrency(kpis.walletBalance)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-4 shadow-warm">
            <div className="text-xs text-muted font-bold mb-1.5">إجمالي الرصيد (نقدية + محفظة)</div>
            <div className="text-2xl font-black text-sage">
              {formatCurrency(kpis.totalBalance)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>
        </div>

        {/* Right Column: Inventory, Receivables, Payables, Expenses */}
        <div className="flex flex-col gap-3">
          <div
            onClick={() => onNavigateTab("inventory")}
            className="bg-surface border border-border rounded-2xl p-4 shadow-warm hover:border-accent/40 transition cursor-pointer"
          >
            <div className="text-xs text-muted font-bold mb-1.5">رصيد المخزون (بالتكلفة)</div>
            <div className="text-2xl font-black text-accent-dark">
              {formatCurrency(kpis.stockValuation)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("receivable")}
            className="bg-surface border border-border rounded-2xl p-4 shadow-warm hover:border-accent/40 transition cursor-pointer"
          >
            <div className="text-xs text-muted font-bold mb-1.5">الفلوس اللي لينا (على العملاء)</div>
            <div className="text-2xl font-black text-ink">
              {formatCurrency(kpis.totalReceivables)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("payable")}
            className="bg-surface border border-border rounded-2xl p-4 shadow-warm hover:border-danger/40 transition cursor-pointer"
          >
            <div className="text-xs text-muted font-bold mb-1.5">الفلوس اللي علينا (للموردين)</div>
            <div className="text-2xl font-black text-danger">
              {formatCurrency(kpis.totalPayables)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("expenses")}
            className="bg-surface border border-border rounded-2xl p-4 shadow-warm hover:border-danger/40 transition cursor-pointer"
          >
            <div className="text-xs text-muted font-bold mb-1.5">إجمالي المصروفات (كل الوقت)</div>
            <div className="text-2xl font-black text-danger">
              {formatCurrency(kpis.totalExpenses)} <span className="text-sm font-medium">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Capital Card (Visible to Owner Role) */}
      {isOwnerRole && (
        <div className="bg-gradient-to-r from-ink via-[#3d362c] to-ink text-white rounded-2xl p-6 text-center shadow-warm-md">
          <div className="text-accent-soft text-xs font-bold mb-1 tracking-wide">
            إجمالي رأس المال التشغيلي
          </div>
          <div className="text-3xl md:text-4xl font-black text-[#8FD19E] my-1">
            {formatCurrency(kpis.capital)} <span className="text-lg font-bold">ج.م</span>
          </div>
          <div className="text-[11.5px] text-[#c9bfa8] mt-2 font-medium">
            = النقدية + المحفظة + الفلوس اللي لينا + المخزون بالتكلفة − الفلوس اللي علينا
          </div>
        </div>
      )}

      {/* Backup Reminder Banner */}
      {needBackup && (
        <div className="bg-danger-soft border border-danger/20 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-xs md:text-sm font-bold text-danger">
            <Database className="w-5 h-5 flex-shrink-0" />
            <span>مرّ وقت طويل من غير ما تاخد نسخة احتياطية — يفضل تصدّر نسخة دلوقتي.</span>
          </div>
          <button
            onClick={() => onNavigateTab("backup")}
            className="bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-accent-dark transition"
          >
            روح للنسخة الاحتياطية
          </button>
        </div>
      )}

      {/* Overdue Orders Alert Panel */}
      {overdueOrders.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
          <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
            <h2 className="text-base font-black text-ink flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <span>⏰ أوردرات لسه ماتسلمتش (10 أيام فأكتر)</span>
            </h2>
            <span className="text-xs font-bold text-danger bg-danger-soft px-2.5 py-0.5 rounded-full">
              {overdueOrders.length} أوردر معلق
            </span>
          </div>
          <div className="divide-y divide-border/60">
            {overdueOrders.map((o: any) => (
              <div
                key={o.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs md:text-sm font-bold"
              >
                <div>
                  <span className="font-extrabold text-ink">{o.customerName}</span>
                  <span className="text-muted text-xs mr-2">— أوردر بتاريخ {o.orderDate}</span>
                </div>
                <span className="text-danger bg-danger-soft px-2 py-0.5 rounded-md text-xs font-black">
                  من {daysBetween(o.orderDate)} يوم
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Panel */}
      {lowStockProducts.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
          <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
            <h2 className="text-base font-black text-ink flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger" />
              <span>⚠️ أصناف قربت تخلص من المخزن</span>
            </h2>
            <span className="text-xs font-bold text-accent-dark bg-accent-soft px-2.5 py-0.5 rounded-full">
              {lowStockProducts.length} صنف
            </span>
          </div>
          <div className="divide-y divide-border/60">
            {lowStockProducts.map((p: any) => (
              <div
                key={p.id}
                className="py-2 flex items-center justify-between text-xs md:text-sm font-bold"
              >
                <span className="text-ink">
                  <span className="font-mono bg-accent-soft text-accent-dark px-1.5 py-0.5 rounded text-[11px] ml-2">
                    {p.code}
                  </span>
                  {p.name}
                </span>
                <span className="text-danger font-extrabold">
                  متبقي {p.stock} قطعة (الحد الأدنى: {p.minStock})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Panel */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <h2 className="text-base font-black text-ink mb-3 pb-2 border-b border-border">آخر الحركات</h2>
        {recentActivities.length === 0 ? (
          <div className="text-center py-8 text-muted text-xs">لسه مفيش حركات مسجلة</div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentActivities.slice(0, 8).map((act, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs font-bold">
                <span className="text-ink">{act.text}</span>
                <span className="text-muted text-[11px]">{act.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Adjust Modal */}
      {adjustModal.open && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-warm-lg animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-ink mb-2">
              تعديل رصيد {adjustModal.method === "cash" ? "النقدية (كاش)" : "المحفظة"}
            </h3>
            <p className="text-xs text-muted mb-4">
              اكتب رقماً موجباً للإضافة (مثلاً 500)، أو سالباً للخصم (مثلاً -200):
            </p>
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <input
                type="number"
                step="0.01"
                autoFocus
                placeholder="المبلغ (+ أو -)"
                value={adjustModal.amount}
                onChange={(e) => setAdjustModal({ ...adjustModal, amount: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-ink font-bold focus:border-accent outline-none text-left font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-accent text-white font-bold py-2 rounded-xl text-xs hover:bg-accent-dark transition"
                >
                  حفظ التعديل
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustModal({ open: false, method: "cash", amount: "" })}
                  className="px-4 py-2 border border-border text-muted font-bold rounded-xl text-xs hover:bg-bg transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
