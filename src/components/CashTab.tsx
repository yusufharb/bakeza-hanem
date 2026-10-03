"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr, getMethodLabel } from "@/lib/utils";
import { Plus, Edit, Trash2, ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";

interface CashTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const CashTab: React.FC<CashTabProps> = ({ data, onRefresh }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    type: "in" | "out";
    method: "cash" | "wallet";
    amount: string;
    date: string;
    source: string;
  }>({
    type: "in",
    method: "cash",
    amount: "",
    date: todayStr(),
    source: "",
  });

  const cashEntries = data?.cashEntries || [];
  const sortedEntries = [...cashEntries].sort((a: any, b: any) =>
    b.date.localeCompare(a.date)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(formData.amount);
    if (!val || val <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/cash/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch("/api/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }

      setIsFormOpen(false);
      setEditingId(null);
      setFormData({
        type: "in",
        method: "cash",
        amount: "",
        date: todayStr(),
        source: "",
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء حفظ حركة الخزنة");
    }
  };

  const handleEditClick = (c: any) => {
    if (c.isAuto) {
      alert("الحركة دي تلقائية من عملية تانية (أوردر/شراء/مصروف)، لازم تعدّلها من مكانها الأصلي.");
      return;
    }
    setEditingId(c.id);
    setFormData({
      type: c.type,
      method: c.method,
      amount: String(c.amount),
      date: c.date,
      source: c.source || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = async (c: any) => {
    if (c.isAuto) {
      alert("الحركة دي تلقائية من عملية تانية، احذفها من مكانها الأصلي (الأوردر/الشراء/المصروف).");
      return;
    }
    if (!confirm("حذف حركة الخزنة اليدوية دي؟ (تقدر ترجّعها من سلة المحذوفات)")) return;

    try {
      const res = await fetch(`/api/cash/${c.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل حذف حركة الخزنة");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-base font-black text-ink">الخزنة ودفتر اليومية</h2>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                type: "in",
                method: "cash",
                amount: "",
                date: todayStr(),
                source: "",
              });
              setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ حركة يدوية</span>
          </button>
        </div>

        <p className="text-xs text-muted mb-4">
          دفتر شامل لكل الحركات النقدية والمحفظة. الحركات التلقائية محمية لمنع تضارب الدفاتر ويتم تعديلها من عمليتها الأصلية فقط.
        </p>

        {/* Manual Cash Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSubmit}
            className="bg-bg border border-accent/40 rounded-2xl p-4 mb-5 space-y-3.5 animate-in fade-in"
          >
            <h3 className="text-xs font-black text-accent-dark">
              {editingId ? "✏️ تعديل حركة خزنة يدوية" : "➕ تسجيل حركة خزنة يدوية"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">نوع الحركة *</label>
                <select
                  value={formData.type}
                  onChange={(e: any) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="in">وارد (إيداع / تحصيل)</option>
                  <option value="out">صادر (صرف / سداد)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">الوعاء المالي *</label>
                <select
                  value={formData.method}
                  onChange={(e: any) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="cash">نقدي (كاش الخزنة)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                </select>
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
                <label className="text-[11px] font-bold text-muted block mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                السبب / البيان
              </label>
              <input
                type="text"
                placeholder="بيان حركة الخزنة..."
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="px-6 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition shadow-sm"
              >
                حفظ الحركة
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

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-bg text-muted border-b border-border font-bold">
              <tr>
                <th className="py-2.5 px-3">التاريخ</th>
                <th className="py-2.5 px-3">النوع</th>
                <th className="py-2.5 px-3">الطريقة</th>
                <th className="py-2.5 px-3">المبلغ</th>
                <th className="py-2.5 px-3">السبب / البيان</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-white font-bold">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    مفيش حركات كاش أو محفظة لسه
                  </td>
                </tr>
              ) : (
                sortedEntries.map((c: any) => (
                  <tr key={c.id} className="hover:bg-bg/40 transition">
                    <td className="py-2.5 px-3 text-muted">{c.date}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.type === "in"
                            ? "bg-sage-soft text-sage"
                            : "bg-danger-soft text-danger"
                        }`}
                      >
                        {c.type === "in" ? (
                          <>
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>وارد</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3" />
                            <span>صادر</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.method === "wallet"
                            ? "bg-[#EFE6F2] text-[#7A5490]"
                            : "bg-[#E4EDF5] text-[#3E6E96]"
                        }`}
                      >
                        {getMethodLabel(c.method)}
                      </span>
                      {c.isAuto && (
                        <span className="text-muted text-[10px] mr-1.5 font-normal">
                          (تلقائي)
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-black ${
                        c.type === "in" ? "text-sage" : "text-danger"
                      }`}
                    >
                      {formatCurrency(c.amount)} ج.م
                    </td>
                    <td className="py-2.5 px-3 text-ink">{c.source || "-"}</td>
                    <td className="py-2.5 px-3 text-center">
                      {c.isAuto ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-muted/60"
                          title="قيد تلقائي مرتبط بعملية أصلية"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(c)}
                            className="p-1 text-muted hover:text-ink transition rounded"
                            title="تعديل الحركة اليدوية"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(c)}
                            className="p-1 text-danger hover:text-danger/80 transition rounded"
                            title="حذف الحركة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
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
