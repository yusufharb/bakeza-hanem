"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr } from "@/lib/utils";
import { calculatePurchaseTotal, calculatePurchasePaid, calculatePurchaseRemaining } from "@/lib/finance";
import { Plus, DollarSign, Edit, Trash2 } from "lucide-react";

interface PayablesTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const PayablesTab: React.FC<PayablesTabProps> = ({ data, onRefresh }) => {
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [manualFormData, setManualFormData] = useState({
    name: "",
    amount: "",
    date: todayStr(),
    note: "",
    paidAmount: "0",
  });

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    kind: "purchase" | "manual";
    id: string;
    supplier: string;
    remaining: number;
    amount: string;
    method: "cash" | "wallet";
  }>({
    open: false,
    kind: "purchase",
    id: "",
    supplier: "",
    remaining: 0,
    amount: "",
    method: "cash",
  });

  const purchases = data?.purchases || [];
  const manualPayables = data?.manualPayables || [];

  // Group by supplier
  const groups: Record<
    string,
    {
      name: string;
      items: {
        kind: "purchase" | "manual";
        id: string;
        name: string;
        date: string;
        total: number;
        paid: number;
        rem: number;
        note: string;
      }[];
      total: number;
      paid: number;
      rem: number;
      lastDate: string;
    }
  > = {};

  // 1. From Purchases with remaining > 0
  purchases.forEach((pu: any) => {
    const rem = calculatePurchaseRemaining(pu.unitCost, pu.qty, pu.payments);
    if (rem > 0.001) {
      const key = (pu.supplier || "مورد غير محدد").trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: pu.supplier,
          items: [],
          total: 0,
          paid: 0,
          rem: 0,
          lastDate: pu.purchaseDate,
        };
      }
      const total = calculatePurchaseTotal(pu.unitCost, pu.qty);
      const paid = calculatePurchasePaid(pu.payments);
      groups[key].items.push({
        kind: "purchase",
        id: pu.id,
        name: pu.supplier,
        date: pu.purchaseDate,
        total,
        paid,
        rem,
        note: `شراء مخزون: ${pu.product?.name || "-"} ×${pu.qty}`,
      });
      groups[key].total += total;
      groups[key].paid += paid;
      groups[key].rem += rem;
      if (pu.purchaseDate > groups[key].lastDate) groups[key].lastDate = pu.purchaseDate;
    }
  });

  // 2. From Manual Payables with remaining > 0
  manualPayables.forEach((m: any) => {
    const paid = m.payments.reduce((s: number, p: any) => s + p.amount, 0);
    const rem = Math.max(0, m.amount - paid);
    if (rem > 0.001) {
      const key = m.name.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: m.name,
          items: [],
          total: 0,
          paid: 0,
          rem: 0,
          lastDate: m.date,
        };
      }
      groups[key].items.push({
        kind: "manual",
        id: m.id,
        name: m.name,
        date: m.date,
        total: m.amount,
        paid,
        rem,
        note: m.note || "-",
      });
      groups[key].total += m.amount;
      groups[key].paid += paid;
      groups[key].rem += rem;
      if (m.date > groups[key].lastDate) groups[key].lastDate = m.date;
    }
  });

  const sortedGroups = Object.values(groups).sort((a, b) =>
    b.lastDate.localeCompare(a.lastDate)
  );

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFormData.name.trim() || Number(manualFormData.amount) <= 0) {
      alert("يرجى إدخال اسم الجهة والمبلغ بشكل صحيح");
      return;
    }

    try {
      if (editingManualId) {
        const res = await fetch(`/api/payables/${editingManualId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manualFormData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch("/api/payables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manualFormData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }

      setIsManualFormOpen(false);
      setEditingManualId(null);
      setManualFormData({
        name: "",
        amount: "",
        date: todayStr(),
        note: "",
        paidAmount: "0",
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء حفظ السند اليدوي");
    }
  };

  const handleDeleteManual = async (id: string) => {
    if (!confirm("حذف هذا الالتزام ونقله لسلة المحذوفات؟")) return;
    try {
      const res = await fetch(`/api/payables/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل حذف الالتزام");
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(paymentModal.amount);
    if (!val || val <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (val > paymentModal.remaining + 0.001) {
      alert("المبلغ المدخل أكبر من المتبقي للمورد");
      return;
    }

    try {
      const url =
        paymentModal.kind === "purchase"
          ? `/api/purchases/${paymentModal.id}/payment`
          : `/api/payables/${paymentModal.id}/payment`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: val,
          method: paymentModal.method,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPaymentModal({ ...paymentModal, open: false, amount: "" });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل سداد الدفعة");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-base font-black text-ink">الفلوس اللي علينا (للموردين)</h2>
          <button
            onClick={() => {
              setEditingManualId(null);
              setManualFormData({
                name: "",
                amount: "",
                date: todayStr(),
                note: "",
                paidAmount: "0",
              });
              setIsManualFormOpen(true);
            }}
            className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ إدخال يدوي</span>
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          القائمة دي بتتحدث تلقائي من عمليات شراء المخزون الآجل، وتقدر كمان تضيف مبالغ يدوي لأول مرة أو لأي التزام مالي خارج عمليات الشراء.
        </p>

        {/* Manual Form */}
        {isManualFormOpen && (
          <form
            onSubmit={handleManualSubmit}
            className="bg-bg border border-accent/40 rounded-2xl p-4 mb-5 space-y-3.5 animate-in fade-in"
          >
            <h3 className="text-xs font-black text-accent-dark">
              {editingManualId ? "✏️ تعديل التزام يدوي" : "➕ إضافة التزام يدوي لمورد"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">الجهة / المورد *</label>
                <input
                  type="text"
                  required
                  value={manualFormData.name}
                  onChange={(e) => setManualFormData({ ...manualFormData, name: e.target.value })}
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
                  value={manualFormData.amount}
                  onChange={(e) => setManualFormData({ ...manualFormData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={manualFormData.date}
                  onChange={(e) => setManualFormData({ ...manualFormData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  مدفوع بالفعل الآن (اختياري)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualFormData.paidAmount}
                  onChange={(e) =>
                    setManualFormData({ ...manualFormData, paidAmount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  ملاحظات (ده مبلغ إيه؟)
                </label>
                <input
                  type="text"
                  value={manualFormData.note}
                  onChange={(e) => setManualFormData({ ...manualFormData, note: e.target.value })}
                  placeholder="سبب الالتزام..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="px-6 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition shadow-sm"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setIsManualFormOpen(false)}
                className="px-4 py-2 border border-border text-muted font-bold text-xs rounded-xl hover:bg-white transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Payables Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-bg text-muted border-b border-border font-bold">
              <tr>
                <th className="py-2.5 px-3">الجهة / المورد</th>
                <th className="py-2.5 px-3">التاريخ</th>
                <th className="py-2.5 px-3">الإجمالي</th>
                <th className="py-2.5 px-3">المدفوع</th>
                <th className="py-2.5 px-3">الباقي</th>
                <th className="py-2.5 px-3">ملاحظات</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-white">
              {sortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted font-bold text-sm">
                    مفيش حاجة علينا حالياً 🎉
                  </td>
                </tr>
              ) : (
                sortedGroups.map((g) => (
                  <React.Fragment key={g.name}>
                    {/* Header Row per Supplier */}
                    <tr className="bg-bg/80 font-black text-ink">
                      <td className="py-2.5 px-3">
                        <span className="text-sm">{g.name}</span>
                        {g.items.length > 1 && (
                          <span className="text-muted text-[11px] font-normal mr-2">
                            ({g.items.length} عملية)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted font-bold">{g.lastDate}</td>
                      <td className="py-2.5 px-3 font-mono">{formatCurrency(g.total)} ج.م</td>
                      <td className="py-2.5 px-3 font-mono text-sage">
                        {formatCurrency(g.paid)} ج.م
                      </td>
                      <td className="py-2.5 px-3 font-mono text-danger font-black">
                        {formatCurrency(g.rem)} ج.م
                      </td>
                      <td className="py-2.5 px-3 text-muted"></td>
                      <td className="py-2.5 px-3 text-center"></td>
                    </tr>

                    {/* Sub-rows per operation */}
                    {g.items.map((sub) => (
                      <tr key={sub.id} className="hover:bg-bg/30 transition text-muted">
                        <td className="py-2 px-3 pr-8 font-bold text-ink flex items-center gap-1.5">
                          <span>↳</span>
                          <span className="text-[11px] bg-border/50 px-1.5 py-0.5 rounded">
                            {sub.kind === "purchase" ? "شراء مخزون آجل" : "سند يدوي"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] font-medium">{sub.date}</td>
                        <td className="py-2 px-3 font-mono text-ink">
                          {formatCurrency(sub.total)} ج.م
                        </td>
                        <td className="py-2 px-3 font-mono text-sage">
                          {formatCurrency(sub.paid)} ج.م
                        </td>
                        <td className="py-2 px-3 font-mono text-danger font-bold">
                          {formatCurrency(sub.rem)} ج.م
                        </td>
                        <td className="py-2 px-3 text-[11px] max-w-xs truncate">{sub.note}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() =>
                                setPaymentModal({
                                  open: true,
                                  kind: sub.kind,
                                  id: sub.id,
                                  supplier: sub.name,
                                  remaining: sub.rem,
                                  amount: String(sub.rem),
                                  method: "cash",
                                })
                              }
                              className="px-2.5 py-0.5 bg-sage-soft text-sage hover:bg-sage/20 rounded-md text-[11px] font-bold flex items-center gap-1"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>سداد دفعة</span>
                            </button>

                            {sub.kind === "manual" && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingManualId(sub.id);
                                    setManualFormData({
                                      name: sub.name,
                                      amount: String(sub.total),
                                      date: sub.date,
                                      note: sub.note === "-" ? "" : sub.note,
                                      paidAmount: String(sub.paid),
                                    });
                                    setIsManualFormOpen(true);
                                  }}
                                  className="p-1 text-muted hover:text-ink rounded"
                                  title="تعديل السند اليدوي"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteManual(sub.id)}
                                  className="p-1 text-danger hover:text-danger/80 rounded"
                                  title="حذف السند"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-warm-lg">
            <h3 className="text-base font-black text-ink mb-1">
              سداد دفعة للمورد: {paymentModal.supplier}
            </h3>
            <p className="text-xs text-muted mb-4 font-bold">
              المبلغ المتبقي:{" "}
              <span className="text-danger font-mono font-black">
                {formatCurrency(paymentModal.remaining)} ج.م
              </span>
            </p>

            <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">قيمة الدفعة *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentModal.remaining}
                  required
                  autoFocus
                  value={paymentModal.amount}
                  onChange={(e) =>
                    setPaymentModal({ ...paymentModal, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">
                  طريقة السداد (خرجت منين) *
                </label>
                <select
                  value={paymentModal.method}
                  onChange={(e: any) =>
                    setPaymentModal({ ...paymentModal, method: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="cash">نقدي (كاش الخزنة)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-sage text-white font-bold py-2 rounded-xl text-xs hover:bg-sage/90 transition shadow-sm"
                >
                  تأكيد السداد
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModal({ ...paymentModal, open: false })}
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
