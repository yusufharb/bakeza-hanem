"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr, getMethodLabel } from "@/lib/utils";
import { Plus, Edit, Trash2 } from "lucide-react";

interface ExpensesTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ data, onRefresh }) => {
  const [filterDate, setFilterDate] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    date: string;
    amount: string;
    reason: string;
    method: "cash" | "wallet";
  }>({
    date: todayStr(),
    amount: "",
    reason: "",
    method: "cash",
  });

  const expenses = data?.expenses || [];
  const cashEntries = data?.cashEntries || [];

  const currentCash = cashEntries
    .filter((c: any) => c.method === "cash")
    .reduce((s: number, c: any) => s + (c.type === "in" ? c.amount : -c.amount), 0);
  const currentWallet = cashEntries
    .filter((c: any) => c.method === "wallet")
    .reduce((s: number, c: any) => s + (c.type === "in" ? c.amount : -c.amount), 0);

  // Filter expenses
  let filtered = [...expenses];
  if (filterDate) {
    filtered = filtered.filter((e: any) => e.date === filterDate);
  }
  filtered.sort((a: any, b: any) => b.date.localeCompare(a.date));

  const totalFiltered = filtered.reduce((s: number, e: any) => s + e.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(formData.amount);
    if (!val || val <= 0 || !formData.reason.trim()) {
      alert("يرجى إدخال المبلغ والسبب بشكل صحيح");
      return;
    }

    // Negative balance check & warning
    const currentBalance = formData.method === "cash" ? currentCash : currentWallet;
    if (currentBalance - val < 0) {
      const label = formData.method === "cash" ? "النقدية (كاش)" : "المحفظة";
      if (
        !confirm(
          `تنبيه: العملية دي هتخلي رصيد ${label} يبقى سالب (${formatCurrency(
            currentBalance - val
          )} ج.م). تكمل؟`
        )
      ) {
        return;
      }
    }

    try {
      if (editingExpenseId) {
        const res = await fetch(`/api/expenses/${editingExpenseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }

      setIsFormOpen(false);
      setEditingExpenseId(null);
      setFormData({
        date: todayStr(),
        amount: "",
        reason: "",
        method: "cash",
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء حفظ المصروف");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف المصروف ده؟ (تقدر ترجّعه من سلة المحذوفات)")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل حذف المصروف");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-base font-black text-ink">المصروفات</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate("")}
                className="px-3 py-1.5 border border-border text-muted hover:text-ink font-bold text-xs rounded-xl hover:bg-bg transition"
              >
                عرض الكل
              </button>
            )}

            <button
              onClick={() => {
                setEditingExpenseId(null);
                setFormData({
                  date: todayStr(),
                  amount: "",
                  reason: "",
                  method: "cash",
                });
                setIsFormOpen(true);
              }}
              className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ مصروف جديد</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-muted mb-3">
          اختار يوماً معيناً لتصفية مصروفاته فقط، أو اضغط "عرض الكل" لرؤية السجل كاملاً.
        </p>

        <div className="text-xs font-extrabold text-ink bg-bg p-2.5 rounded-xl border border-border/80 mb-4 inline-block">
          {filterDate
            ? `إجمالي مصروفات يوم ${filterDate}: `
            : "إجمالي كل المصروفات: "}
          <span className="text-danger font-mono font-black">
            {formatCurrency(totalFiltered)} ج.م
          </span>
        </div>

        {/* Add/Edit Expense Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSubmit}
            className="bg-bg border border-accent/40 rounded-2xl p-4 mb-5 space-y-3.5 animate-in fade-in"
          >
            <h3 className="text-xs font-black text-accent-dark">
              {editingExpenseId ? "✏️ تعديل مصروف" : "➕ تسجيل مصروف جديد"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">المبلغ *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  السبب / البند *
                </label>
                <input
                  type="text"
                  required
                  placeholder="شحن، تغليف، إعلانات، صيانة..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  طريقة الدفع *
                </label>
                <select
                  value={formData.method}
                  onChange={(e: any) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="cash">نقدي (كاش الخزنة)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="px-6 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition shadow-sm"
              >
                حفظ المصروف
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-border text-muted font-bold text-xs rounded-xl hover:bg-white transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Expenses Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-bg text-muted border-b border-border font-bold">
              <tr>
                <th className="py-2.5 px-3">التاريخ</th>
                <th className="py-2.5 px-3">السبب / البند</th>
                <th className="py-2.5 px-3">المبلغ</th>
                <th className="py-2.5 px-3">طريقة الدفع</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-white font-bold">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted">
                    لسه مفيش مصروفات مسجّلة
                  </td>
                </tr>
              ) : (
                filtered.map((e: any) => (
                  <tr key={e.id} className="hover:bg-bg/40 transition">
                    <td className="py-2.5 px-3 text-muted">{e.date}</td>
                    <td className="py-2.5 px-3 text-ink">{e.reason}</td>
                    <td className="py-2.5 px-3 font-mono text-danger">
                      {formatCurrency(e.amount)} ج.م
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.method === "wallet"
                            ? "bg-[#EFE6F2] text-[#7A5490]"
                            : "bg-[#E4EDF5] text-[#3E6E96]"
                        }`}
                      >
                        {getMethodLabel(e.method)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingExpenseId(e.id);
                            setFormData({
                              date: e.date,
                              amount: String(e.amount),
                              reason: e.reason,
                              method: e.method,
                            });
                            setIsFormOpen(true);
                          }}
                          className="p-1 text-muted hover:text-ink transition rounded"
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="p-1 text-danger hover:text-danger/80 transition rounded"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
