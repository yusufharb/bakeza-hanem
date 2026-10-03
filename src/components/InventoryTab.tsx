"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr } from "@/lib/utils";
import { Plus, Search, Edit, Trash2, DollarSign, Archive } from "lucide-react";

interface InventoryTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ data, onRefresh }) => {
  const [productSearch, setProductSearch] = useState("");
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  // Add/Edit stock form data
  const [stockFormData, setStockFormData] = useState<{
    name: string;
    supplier: string;
    purchaseDate: string;
    unitCost: string;
    qty: string;
    sellingPrice: string;
    payMethod: "cash" | "wallet" | "deferred";
    minStock: string;
  }>({
    name: "",
    supplier: "",
    purchaseDate: todayStr(),
    unitCost: "",
    qty: "1",
    sellingPrice: "",
    payMethod: "cash",
    minStock: "0",
  });

  // Edit product modal
  const [editProductModal, setEditProductModal] = useState<{
    open: boolean;
    id: string;
    name: string;
    sellingPrice: string;
    minStock: string;
  }>({
    open: false,
    id: "",
    name: "",
    sellingPrice: "",
    minStock: "",
  });

  // Purchase payment modal
  const [purchasePaymentModal, setPurchasePaymentModal] = useState<{
    open: boolean;
    purchaseId: string;
    supplier: string;
    remaining: number;
    amount: string;
    method: "cash" | "wallet";
  }>({
    open: false,
    purchaseId: "",
    supplier: "",
    remaining: 0,
    amount: "",
    method: "cash",
  });

  const products = data?.products || [];
  const purchases = data?.purchases || [];

  // Filtered products
  const filteredProducts = products.filter((p: any) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.trim().toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
  });

  const onProductNameInput = (val: string) => {
    setStockFormData((prev) => {
      const match = products.find(
        (p: any) =>
          p.name.trim().toLowerCase() === val.trim().toLowerCase() ||
          (p.code && p.code.toLowerCase() === val.trim().toLowerCase())
      );
      return {
        ...prev,
        name: val,
        sellingPrice: match ? String(match.sellingPrice || "") : prev.sellingPrice,
        minStock: match ? String(match.minStock || 0) : prev.minStock,
      };
    });
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFormData.name.trim()) {
      alert("يرجى إدخال اسم الصنف");
      return;
    }
    const cost = Number(stockFormData.unitCost);
    const quantity = Number(stockFormData.qty);
    const price = Number(stockFormData.sellingPrice);

    if (isNaN(cost) || cost < 0 || isNaN(quantity) || quantity <= 0) {
      alert("يرجى كتابة سعر وتكلفة صحيحة");
      return;
    }

    try {
      if (editingPurchaseId) {
        const res = await fetch(`/api/purchases/${editingPurchaseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stockFormData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stockFormData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }

      setIsStockFormOpen(false);
      setEditingPurchaseId(null);
      setStockFormData({
        name: "",
        supplier: "",
        purchaseDate: todayStr(),
        unitCost: "",
        qty: "1",
        sellingPrice: "",
        payMethod: "cash",
        minStock: "0",
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء حفظ الشراء");
    }
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/products/${editProductModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProductModal.name,
          sellingPrice: Number(editProductModal.sellingPrice) || 0,
          minStock: Number(editProductModal.minStock) || 0,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setEditProductModal({ open: false, id: "", name: "", sellingPrice: "", minStock: "" });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل تعديل المنتج");
    }
  };

  const handleDeleteProduct = async (p: any) => {
    const hasHistory = p.purchases?.length > 0 || p.orderItems?.length > 0;
    const confirmMsg = hasHistory
      ? `الصنف "${p.name}" مسجل عليه مبيعات أو مشتريات سابقة.\nسيتم أرشفته وإيقافه بأمان لحماية الحسابات التاريخية، ولن يظهر في قائمة الأصناف النشطة. تأكيد؟`
      : `حذف الصنف "${p.name}" ونقله لسلة المحذوفات؟`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (json.archived) {
        alert("تم أرشفة الصنف بنجاح وحماية التاريخ المالي.");
      }
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل معالجة حذف الصنف");
    }
  };

  const handleDeletePurchase = async (pu: any) => {
    if (!confirm("حذف عملية الشراء دي؟ (تقدر ترجّعها من سلة المحذوفات)")) return;
    try {
      const res = await fetch(`/api/purchases/${pu.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل حذف عملية الشراء");
    }
  };

  const handlePurchasePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(purchasePaymentModal.amount);
    if (!val || val <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (val > purchasePaymentModal.remaining + 0.001) {
      alert("المبلغ المدخل أكبر من المتبقي للمورد");
      return;
    }

    try {
      const res = await fetch(`/api/purchases/${purchasePaymentModal.purchaseId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: val,
          method: purchasePaymentModal.method,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPurchasePaymentModal({ ...purchasePaymentModal, open: false, amount: "" });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل سداد الدفعة للمورد");
    }
  };

  return (
    <div className="space-y-5">
      {/* Products & Stock Section */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-base font-black text-ink">المخزون والمنتجات</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث بالاسم أو الكود..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-52 pl-3 pr-8 py-2 rounded-xl border border-border text-xs font-bold focus:border-accent outline-none"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-3 text-muted" />
            </div>

            <button
              onClick={() => {
                setEditingPurchaseId(null);
                setStockFormData({
                  name: "",
                  supplier: "",
                  purchaseDate: todayStr(),
                  unitCost: "",
                  qty: "1",
                  sellingPrice: "",
                  payMethod: "cash",
                  minStock: "0",
                });
                setIsStockFormOpen(true);
              }}
              className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة بضاعة</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-muted mb-4">
          اكتب اسم الصنف: لو كان مسجل قبل كده هيتزود على نفس الكمية تلقائي ويُعاد حساب متوسط التكلفة المرجح، ولو جديد هيتسجل كصنف جديد بكود مخصص.
        </p>

        {/* Add Stock Form */}
        {isStockFormOpen && (
          <form
            onSubmit={handleStockSubmit}
            className="bg-bg border border-accent/40 rounded-2xl p-4 mb-5 space-y-3.5 animate-in fade-in"
          >
            <h3 className="text-xs font-black text-accent-dark">
              {editingPurchaseId ? "✏️ تعديل عملية شراء" : "📦 تسجيل وارد بضاعة جديد"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">اسم الصنف *</label>
                <input
                  type="text"
                  required
                  list="inventoryProductNames"
                  value={stockFormData.name}
                  onChange={(e) => onProductNameInput(e.target.value)}
                  placeholder="اسم الصنف..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  اشتريته منين (المحل/المورد) *
                </label>
                <input
                  type="text"
                  required
                  value={stockFormData.supplier}
                  onChange={(e) =>
                    setStockFormData({ ...stockFormData, supplier: e.target.value })
                  }
                  placeholder="اسم المحل أو المورد..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={stockFormData.purchaseDate}
                  onChange={(e) =>
                    setStockFormData({ ...stockFormData, purchaseDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  سعر الوحدة (التكلفة) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={stockFormData.unitCost}
                  onChange={(e) =>
                    setStockFormData({ ...stockFormData, unitCost: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">الكمية *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockFormData.qty}
                  onChange={(e) =>
                    setStockFormData({ ...stockFormData, qty: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  سعر البيع للعميل *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={stockFormData.sellingPrice}
                  onChange={(e) =>
                    setStockFormData({ ...stockFormData, sellingPrice: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">طريقة الدفع *</label>
                <select
                  value={stockFormData.payMethod}
                  onChange={(e: any) =>
                    setStockFormData({ ...stockFormData, payMethod: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="cash">كاش (اتدفع كامل من النقدية)</option>
                  <option value="wallet">محفظة (اتدفع كامل من المحفظة)</option>
                  <option value="deferred">آجل (لسه مدفعتش للمورد)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">
                  حد أدنى للتنبيه عند النواقص (اختياري)
                </label>
                <input
                  type="number"
                  min="0"
                  value={stockFormData.minStock}
                  onChange={(e) =>
                    setStockFormData({ ...stockFormData, minStock: e.target.value })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition shadow-sm"
                >
                  حفظ البضاعة
                </button>
                <button
                  type="button"
                  onClick={() => setIsStockFormOpen(false)}
                  className="px-4 py-2 border border-border text-muted font-bold text-xs rounded-xl hover:bg-white transition"
                >
                  إلغاء
                </button>
              </div>
              <span className="text-[11px] text-muted font-medium">
                لو اخترت "آجل"، المبلغ هيظهر تلقائي في قائمة "الفلوس اللي علينا".
              </span>
            </div>
          </form>
        )}

        <datalist id="inventoryProductNames">
          {products.map((p: any) => (
            <option key={p.id} value={p.name}>
              {p.code}
            </option>
          ))}
        </datalist>

        {/* Products Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-bg text-muted border-b border-border font-bold">
              <tr>
                <th className="py-2.5 px-3">الكود</th>
                <th className="py-2.5 px-3">الصنف</th>
                <th className="py-2.5 px-3">متوسط التكلفة</th>
                <th className="py-2.5 px-3">سعر البيع</th>
                <th className="py-2.5 px-3">الكمية المتاحة</th>
                <th className="py-2.5 px-3">قيمة المخزون</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-white">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted">
                    لسه مفيش أصناف مسجّلة بالمخزن
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p: any) => {
                  const isLow = p.minStock > 0 && p.stock <= p.minStock;
                  const val = p.stock > 0 ? p.stock * p.avgCost : 0;

                  return (
                    <tr key={p.id} className="hover:bg-bg/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-accent-dark">
                        <span className="bg-accent-soft px-1.5 py-0.5 rounded text-[11px]">
                          {p.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-ink">
                        {p.name} {!p.isActive && <span className="text-muted">(مؤرشف)</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {formatCurrency(p.avgCost)} ج.م
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {formatCurrency(p.sellingPrice)} ج.م
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={p.stock <= 0 ? "text-danger" : "text-ink"}>
                          {p.stock}
                        </span>
                        {isLow && (
                          <span className="mr-2 bg-danger-soft text-danger px-1.5 py-0.5 rounded text-[10px] font-bold">
                            قريب يخلص
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-ink">
                        {formatCurrency(val)} ج.م
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() =>
                              setEditProductModal({
                                open: true,
                                id: p.id,
                                name: p.name,
                                sellingPrice: String(p.sellingPrice),
                                minStock: String(p.minStock || 0),
                              })
                            }
                            className="p-1 text-muted hover:text-ink transition rounded"
                            title="تعديل الصنف"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1 text-danger hover:text-danger/80 transition rounded"
                            title="أرشفة أو حذف"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchases History Ledger */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <h2 className="text-base font-black text-ink mb-3 pb-2 border-b border-border">
          سجل عمليات الشراء
        </h2>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-bg text-muted border-b border-border font-bold">
              <tr>
                <th className="py-2.5 px-3">الصنف</th>
                <th className="py-2.5 px-3">المحل/المورد</th>
                <th className="py-2.5 px-3">التاريخ</th>
                <th className="py-2.5 px-3">الكمية</th>
                <th className="py-2.5 px-3">سعر الوحدة</th>
                <th className="py-2.5 px-3">الإجمالي</th>
                <th className="py-2.5 px-3">المدفوع</th>
                <th className="py-2.5 px-3">الباقي</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-white font-bold">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted">
                    لسه مفيش عمليات شراء مسجّلة
                  </td>
                </tr>
              ) : (
                purchases.map((pu: any) => {
                  const paid = pu.payments.reduce((s: number, p: any) => s + p.amount, 0);
                  const remaining = Math.max(0, pu.totalCost - paid);

                  return (
                    <tr key={pu.id} className="hover:bg-bg/40 transition">
                      <td className="py-2.5 px-3 text-ink">
                        {pu.product?.name || "صنف محذوف"}
                      </td>
                      <td className="py-2.5 px-3 text-muted">{pu.supplier}</td>
                      <td className="py-2.5 px-3 text-muted">{pu.purchaseDate}</td>
                      <td className="py-2.5 px-3 font-mono">{pu.qty}</td>
                      <td className="py-2.5 px-3 font-mono">{formatCurrency(pu.unitCost)} ج.م</td>
                      <td className="py-2.5 px-3 font-mono font-black">
                        {formatCurrency(pu.totalCost)} ج.م
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sage">
                        {formatCurrency(paid)} ج.م
                      </td>
                      <td
                        className={`py-2.5 px-3 font-mono ${
                          remaining > 0 ? "text-danger" : "text-muted"
                        }`}
                      >
                        {formatCurrency(remaining)} ج.م
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {remaining > 0 && (
                            <button
                              onClick={() =>
                                setPurchasePaymentModal({
                                  open: true,
                                  purchaseId: pu.id,
                                  supplier: pu.supplier,
                                  remaining,
                                  amount: String(remaining),
                                  method: "cash",
                                })
                              }
                              className="px-2 py-0.5 bg-sage-soft text-sage hover:bg-sage/20 rounded text-[11px] font-bold"
                            >
                              دفعة
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePurchase(pu)}
                            className="p-1 text-danger hover:text-danger/80 transition"
                            title="حذف الشراء"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editProductModal.open && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-warm-lg">
            <h3 className="text-base font-black text-ink mb-3">تعديل الصنف</h3>
            <form onSubmit={handleEditProductSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">اسم الصنف *</label>
                <input
                  type="text"
                  required
                  value={editProductModal.name}
                  onChange={(e) =>
                    setEditProductModal({ ...editProductModal, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">سعر البيع *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editProductModal.sellingPrice}
                  onChange={(e) =>
                    setEditProductModal({
                      ...editProductModal,
                      sellingPrice: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">
                  حد التنبيه الأدنى
                </label>
                <input
                  type="number"
                  min="0"
                  value={editProductModal.minStock}
                  onChange={(e) =>
                    setEditProductModal({ ...editProductModal, minStock: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-accent text-white font-bold py-2 rounded-xl text-xs hover:bg-accent-dark transition"
                >
                  حفظ التعديل
                </button>
                <button
                  type="button"
                  onClick={() => setEditProductModal({ ...editProductModal, open: false })}
                  className="px-4 py-2 border border-border text-muted font-bold rounded-xl text-xs hover:bg-bg transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Payment Modal */}
      {purchasePaymentModal.open && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-warm-lg">
            <h3 className="text-base font-black text-ink mb-1">
              سداد دفعة للمورد — {purchasePaymentModal.supplier}
            </h3>
            <p className="text-xs text-muted mb-4 font-bold">
              المبلغ المتبقي:{" "}
              <span className="text-danger font-mono font-black">
                {formatCurrency(purchasePaymentModal.remaining)} ج.م
              </span>
            </p>

            <form onSubmit={handlePurchasePaymentSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">قيمة الدفعة *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={purchasePaymentModal.remaining}
                  required
                  autoFocus
                  value={purchasePaymentModal.amount}
                  onChange={(e) =>
                    setPurchasePaymentModal({ ...purchasePaymentModal, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold focus:border-accent outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted block mb-1">
                  طريقة السداد (خرجت منين) *
                </label>
                <select
                  value={purchasePaymentModal.method}
                  onChange={(e: any) =>
                    setPurchasePaymentModal({ ...purchasePaymentModal, method: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="cash">نقدي (كاش)</option>
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
                  onClick={() =>
                    setPurchasePaymentModal({ ...purchasePaymentModal, open: false })
                  }
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
