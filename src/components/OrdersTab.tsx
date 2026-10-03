"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr, daysBetween, getMethodLabel } from "@/lib/utils";
import {
  calculateOrderTotal,
  calculateOrderCostTotal,
  calculateOrderMargin,
  calculateOrderPaid,
  calculateOrderRemaining,
  calculateDayClosing,
  checkOrderMissingFields,
} from "@/lib/finance";
import {
  Plus,
  Search,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Trash2,
  Edit,
  DollarSign,
} from "lucide-react";

interface OrdersTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({ data, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [plDate, setPlDate] = useState(todayStr());
  const [showPurchaseList, setShowPurchaseList] = useState(false);
  const [dayClosingModal, setDayClosingModal] = useState<any>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    customerName: string;
    customerPhone: string;
    orderDate: string;
    payStatus: "full" | "partial" | "none";
    method: "cash" | "wallet";
    purchMethod: "cash" | "wallet";
    paidAmount: string;
    isDelivered: boolean;
    notes: string;
    items: {
      productId: string | null;
      productName: string;
      qty: number;
      sellPrice: number;
      source: "stock" | "supplier";
      shopName: string;
      costPrice: number;
      forceSupplier: boolean;
    }[];
  }>({
    customerName: "",
    customerPhone: "",
    orderDate: todayStr(),
    payStatus: "full",
    method: "cash",
    purchMethod: "cash",
    paidAmount: "0",
    isDelivered: false,
    notes: "",
    items: [
      {
        productId: null,
        productName: "",
        qty: 1,
        sellPrice: 0,
        source: "supplier",
        shopName: "",
        costPrice: 0,
        forceSupplier: false,
      },
    ],
  });

  // Payment installment modal
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    orderId: string;
    customerName: string;
    remaining: number;
    amount: string;
    method: "cash" | "wallet";
  }>({
    open: false,
    orderId: "",
    customerName: "",
    remaining: 0,
    amount: "",
    method: "cash",
  });

  const orders = data?.orders || [];
  const products = data?.products || [];
  const purchases = data?.purchases || [];
  const expenses = data?.expenses || [];

  // Helper product lookup
  const findProduct = (name: string) => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return null;
    return (
      products.find(
        (p: any) =>
          p.name.trim().toLowerCase() === n || (p.code && p.code.toLowerCase() === n)
      ) || null
    );
  };

  // Filtered orders
  const filteredOrders = orders.filter((o: any) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.toLowerCase().includes(q) ||
      o.notes?.toLowerCase().includes(q)
    );
  });

  // Client statement if search term matched
  const matchedClientOrders = searchTerm.trim()
    ? orders.filter((o: any) =>
        o.customerName?.toLowerCase().includes(searchTerm.trim().toLowerCase())
      )
    : [];

  const clientStatement = matchedClientOrders.length > 0 ? {
    count: matchedClientOrders.length,
    totalBought: matchedClientOrders.reduce(
      (sum: number, o: any) => sum + calculateOrderTotal(o.items),
      0
    ),
    totalPaid: matchedClientOrders.reduce(
      (sum: number, o: any) => sum + calculateOrderPaid(o.payments),
      0
    ),
    totalRemaining: matchedClientOrders.reduce(
      (sum: number, o: any) => sum + calculateOrderRemaining(o.items, o.payments),
      0
    ),
  } : null;

  // Daily Purchase List grouped by shop
  const dailyShoppingGroups: Record<
    string,
    { product: string; customer: string; qty: number; cost: number; sell: number }[]
  > = {};
  orders
    .filter((o: any) => o.orderDate === plDate)
    .forEach((o: any) => {
      o.items.forEach((it: any) => {
        if (it.source === "supplier") {
          const shop = it.shopName?.trim() || "محل غير محدد";
          if (!dailyShoppingGroups[shop]) dailyShoppingGroups[shop] = [];
          dailyShoppingGroups[shop].push({
            product: it.productName,
            customer: o.customerName,
            qty: it.qty,
            cost: it.costPrice,
            sell: it.sellPrice,
          });
        }
      });
    });

  // Form helpers
  const handleItemProductInput = (index: number, val: string) => {
    const updated = [...formData.items];
    const it = updated[index];
    it.productName = val;

    if (!it.forceSupplier) {
      const match = findProduct(val);
      if (match) {
        it.source = "stock";
        it.productId = match.id;
        it.costPrice = match.avgCost || match.currentAvgCost || 0;
        if (!it.sellPrice) it.sellPrice = match.sellingPrice || 0;
      } else {
        it.source = "supplier";
        it.productId = null;
      }
    }
    setFormData({ ...formData, items: updated });
  };

  const toggleLineOverride = (index: number) => {
    const updated = [...formData.items];
    const it = updated[index];
    it.forceSupplier = !it.forceSupplier;
    if (it.forceSupplier) {
      it.source = "supplier";
      it.productId = null;
    } else {
      const match = findProduct(it.productName);
      if (match) {
        it.source = "stock";
        it.productId = match.id;
        it.costPrice = match.avgCost || match.currentAvgCost || 0;
      }
    }
    setFormData({ ...formData, items: updated });
  };

  const addItemLine = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          productId: null,
          productName: "",
          qty: 1,
          sellPrice: 0,
          source: "supplier",
          shopName: "",
          costPrice: 0,
          forceSupplier: false,
        },
      ],
    });
  };

  const removeItemLine = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  // Totals preview
  const previewSell = calculateOrderTotal(formData.items as any);
  const previewCost = calculateOrderCostTotal(formData.items as any);
  const previewMargin = previewSell - previewCost;
  const hasSupplierItems = formData.items.some((it) => it.source === "supplier");

  const openNewOrderForm = () => {
    setEditingOrderId(null);
    setFormData({
      customerName: "",
      customerPhone: "",
      orderDate: todayStr(),
      payStatus: "full",
      method: "cash",
      purchMethod: "cash",
      paidAmount: "0",
      isDelivered: false,
      notes: "",
      items: [
        {
          productId: null,
          productName: "",
          qty: 1,
          sellPrice: 0,
          source: "supplier",
          shopName: "",
          costPrice: 0,
          forceSupplier: false,
        },
      ],
    });
    setIsFormOpen(true);
  };

  const openEditOrder = (o: any) => {
    setEditingOrderId(o.id);
    const paid = calculateOrderPaid(o.payments);
    const total = calculateOrderTotal(o.items);
    let payStatus: "full" | "partial" | "none" = "none";
    if (paid >= total && total > 0) payStatus = "full";
    else if (paid > 0) payStatus = "partial";

    setFormData({
      customerName: o.customerName,
      customerPhone: o.customerPhone || "",
      orderDate: o.orderDate,
      payStatus,
      method: (o.method as any) || "cash",
      purchMethod: (o.purchMethod as any) || "cash",
      paidAmount: String(paid),
      isDelivered: Boolean(o.isDelivered),
      notes: o.notes || "",
      items: o.items.map((it: any) => ({
        productId: it.productId,
        productName: it.productName,
        qty: it.qty,
        sellPrice: it.sellPrice,
        source: it.source,
        shopName: it.shopName || "",
        costPrice: it.costPrice,
        forceSupplier: it.source === "supplier" && Boolean(findProduct(it.productName)),
      })),
    });
    setIsFormOpen(true);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      alert("يرجى إدخال اسم العميل");
      return;
    }
    if (formData.items.length === 0) {
      alert("يجب إضافة صنف واحد على الأقل");
      return;
    }

    // Validate supplier items have shop name
    for (const it of formData.items) {
      if (!it.productName.trim()) {
        alert("يرجى كتابة اسم كل صنف");
        return;
      }
      if (it.source === "supplier" && !it.shopName.trim()) {
        alert(`يرجى كتابة اسم المحل للصنف "${it.productName}"`);
        return;
      }
    }

    try {
      if (editingOrderId) {
        // Edit order
        const res = await fetch(`/api/orders/${editingOrderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        // Create new order
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        if (formData.isDelivered) {
          alert(
            `تم تسليم الأوردر لـ ${formData.customerName} ✅\n\nإجمالي البيع: ${formatCurrency(
              previewSell
            )} ج.م\nالتكلفة: ${formatCurrency(previewCost)} ج.م\nصافي المكسب: ${formatCurrency(
              previewMargin
            )} ج.م`
          );
        }
      }

      setIsFormOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء حفظ الأوردر");
    }
  };

  const handleToggleDelivered = async (o: any) => {
    try {
      const res = await fetch(`/api/orders/${o.id}/deliver`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();

      if (!o.isDelivered) {
        const sell = calculateOrderTotal(o.items);
        const cost = calculateOrderCostTotal(o.items);
        const margin = sell - cost;
        alert(
          `تم تسليم الأوردر لـ ${o.customerName} ✅\n\nاشتريت بضاعة بـ: ${formatCurrency(
            cost
          )} ج.م\nبعت بـ: ${formatCurrency(sell)} ج.م\nصافي المكسب: ${formatCurrency(margin)} ج.م`
        );
      }
    } catch (err: any) {
      alert(err.message || "فشل تغيير حالة التسليم");
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("حذف الأوردر ده؟ هيتنقل لسلة المحذوفات وتتسحب قيود الخزينة بتاعته مؤقتاً."))
      return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || "فشل حذف الأوردر");
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
      alert(`المبلغ المدخل (${val}) أكبر من الباقي على العميل (${paymentModal.remaining})`);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${paymentModal.orderId}/payment`, {
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
      alert(err.message || "فشل تسجيل الدفعة");
    }
  };

  const triggerDayClosing = () => {
    const today = todayStr();
    const todayOrders = orders.filter((o: any) => o.orderDate === today);
    const todayPurchases = purchases.filter((p: any) => p.purchaseDate === today);
    const todayExpenses = expenses.filter((e: any) => e.date === today);
    const closing = calculateDayClosing(todayOrders, todayPurchases, todayExpenses);
    setDayClosingModal({ date: today, ...closing });
  };

  return (
    <div className="space-y-5">
      {/* Daily Shopping List Panel */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            <h2 className="text-base font-black text-ink">قائمة الشراء لليوم</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={plDate}
              onChange={(e) => setPlDate(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-xl text-xs font-bold outline-none focus:border-accent"
            />
            <button
              onClick={() => setShowPurchaseList(!showPurchaseList)}
              className="px-3.5 py-1.5 bg-accent-soft text-accent-dark font-bold text-xs rounded-xl hover:bg-accent/20 transition"
            >
              {showPurchaseList ? "إخفاء القائمة" : "عرض القائمة"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-muted">
          قائمة بكل الأصناف اللي لازم تجيبها من المحلات في التاريخ المحدد، مرتبة بحيث تكون أصناف كل محل تحت بعض.
        </p>

        {showPurchaseList && (
          <div className="mt-4 space-y-3 pt-3 border-t border-border/60">
            {Object.keys(dailyShoppingGroups).length === 0 ? (
              <div className="text-center py-6 text-muted text-xs">
                مفيش أصناف مطلوبة من محلات في التاريخ ده ({plDate})
              </div>
            ) : (
              Object.entries(dailyShoppingGroups).map(([shop, items]) => (
                <div key={shop} className="bg-bg border border-border rounded-xl p-3.5">
                  <h3 className="text-sm font-black text-ink mb-2">🏬 {shop}</h3>
                  <div className="space-y-1.5 text-xs font-bold text-ink">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 border-b border-border/40 last:border-none"
                      >
                        <span>
                          {it.product} ×{it.qty} — للعميل: {it.customer}
                        </span>
                        <span className="text-muted">
                          شراء: {formatCurrency(it.cost)} ج.م | بيع: {formatCurrency(it.sell)} ج.م
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Orders Manager Header */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-base font-black text-ink">الأوردرات</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث باسم العميل / كشف حساب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 pl-3 pr-8 py-2 rounded-xl border border-border text-xs font-bold focus:border-accent outline-none"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-3 text-muted" />
            </div>

            <button
              onClick={triggerDayClosing}
              className="px-3.5 py-2 bg-accent-soft text-accent-dark font-bold text-xs rounded-xl hover:bg-accent/20 transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>📋 قفلة اليوم</span>
            </button>

            <button
              onClick={openNewOrderForm}
              className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ أوردر جديد</span>
            </button>
          </div>
        </div>

        {/* Client Statement Card (if searched) */}
        {clientStatement && (
          <div className="bg-bg border border-border rounded-xl p-4 mb-4 animate-in fade-in">
            <h3 className="text-xs font-black text-ink mb-2">كشف حساب العميل: "{searchTerm}"</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-surface p-2.5 rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted block font-bold">عدد الأوردرات</span>
                <span className="text-sm font-black text-ink">{clientStatement.count}</span>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted block font-bold">إجمالي المشتريات</span>
                <span className="text-sm font-black text-ink">
                  {formatCurrency(clientStatement.totalBought)} ج.م
                </span>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted block font-bold">إجمالي المدفوع</span>
                <span className="text-sm font-black text-sage">
                  {formatCurrency(clientStatement.totalPaid)} ج.م
                </span>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted block font-bold">الباقي عليه</span>
                <span className="text-sm font-black text-danger">
                  {formatCurrency(clientStatement.totalRemaining)} ج.م
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Order Form */}
        {isFormOpen && (
          <form
            onSubmit={handleOrderSubmit}
            className={`border rounded-2xl p-4 mb-5 space-y-4 ${
              editingOrderId
                ? "bg-accent-soft/20 border-accent"
                : "bg-bg border-dashed border-border"
            }`}
          >
            {editingOrderId && (
              <div className="bg-accent-soft text-accent-dark px-3 py-2 rounded-xl text-xs font-bold">
                ✏️ بتعدّل على أوردر موجود — سيتم تحديث البنود مع الحفاظ على دفعات العميل السابقة
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted block mb-1">
                  رقم الموبايل (اختياري)
                </label>
                <input
                  type="text"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted block mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                />
              </div>
            </div>

            {/* Items List Builder */}
            <div className="space-y-3">
              <label className="text-xs font-black text-ink block">أصناف الأوردر:</label>
              {formData.items.map((it, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-border rounded-xl p-3.5 space-y-2.5 shadow-sm"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-muted block mb-1">
                        اسم الصنف أو الكود
                      </label>
                      <input
                        type="text"
                        required
                        list="productsDatalist"
                        value={it.productName}
                        onChange={(e) => handleItemProductInput(idx, e.target.value)}
                        placeholder="ابحث بالاسم أو الكود..."
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={it.qty}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].qty = Math.max(1, Number(e.target.value) || 1);
                          setFormData({ ...formData, items: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold focus:border-accent outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">
                        سعر البيع للقطعة
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={it.sellPrice}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].sellPrice = Number(e.target.value) || 0;
                          setFormData({ ...formData, items: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold focus:border-accent outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Source Detection & Override */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      {it.source === "stock" ? (
                        <span className="bg-sage-soft text-sage px-2 py-0.5 rounded-md text-[11px] font-bold">
                          📦 من المخزون (تكلفة: {formatCurrency(it.costPrice)} ج.م)
                        </span>
                      ) : (
                        <span className="bg-accent-soft text-accent-dark px-2 py-0.5 rounded-md text-[11px] font-bold">
                          🚚 شراء من مورد خارجي
                        </span>
                      )}

                      {/* Override Button if product exists in inventory */}
                      {findProduct(it.productName) && (
                        <button
                          type="button"
                          onClick={() => toggleLineOverride(idx)}
                          className="text-[11px] text-muted hover:text-accent font-bold underline"
                        >
                          {it.forceSupplier ? "رجّع من المخزون" : "مش من المخزون، هجيبه من برة"}
                        </button>
                      )}
                    </div>

                    {it.qty > 1 && (
                      <span className="text-muted text-xs">
                        الإجمالي: {formatCurrency(it.qty * it.sellPrice)} ج.م
                      </span>
                    )}

                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemLine(idx)}
                        className="text-danger hover:text-danger/80 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الصنف</span>
                      </button>
                    )}
                  </div>

                  {/* Supplier Fields if source === supplier */}
                  {it.source === "supplier" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 bg-bg p-2.5 rounded-lg border border-border/60">
                      <div>
                        <label className="text-[11px] font-bold text-muted block mb-1">
                          اشتريته منين (اسم المحل) *
                        </label>
                        <input
                          type="text"
                          required
                          value={it.shopName}
                          onChange={(e) => {
                            const updated = [...formData.items];
                            updated[idx].shopName = e.target.value;
                            setFormData({ ...formData, items: updated });
                          }}
                          placeholder="اسم المحل أو المورد..."
                          className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold bg-white focus:border-accent outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted block mb-1">
                          سعر الشراء للقطعة (التكلفة) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={it.costPrice}
                          onChange={(e) => {
                            const updated = [...formData.items];
                            updated[idx].costPrice = Number(e.target.value) || 0;
                            setFormData({ ...formData, items: updated });
                          }}
                          className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={addItemLine}
                  className="px-3 py-1.5 bg-accent-soft text-accent-dark rounded-xl text-xs font-bold hover:bg-accent/20 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إضافة صنف</span>
                </button>
                <span className="text-xs text-muted font-bold">
                  عدد الأصناف: {formData.items.length}
                </span>
              </div>
            </div>

            {/* Datalist for autocomplete */}
            <datalist id="productsDatalist">
              {products.map((p: any) => (
                <option key={p.id} value={p.name}>
                  {p.code} - {p.name}
                </option>
              ))}
            </datalist>

            {/* Real-time Order Preview Box */}
            <div className="bg-ink text-white rounded-xl p-4 flex items-center gap-6 flex-wrap shadow-inner">
              <div>
                <span className="text-[11px] text-muted block">إجمالي البيع</span>
                <span className="text-base font-black text-white">
                  {formatCurrency(previewSell)} ج.م
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted block">إجمالي الشراء (التكلفة)</span>
                <span className="text-base font-black text-white">
                  {formatCurrency(previewCost)} ج.م
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted block">صافي المكسب</span>
                <span className="text-base font-black text-[#8FD19E]">
                  {formatCurrency(previewMargin)} ج.م
                </span>
              </div>
            </div>

            {/* Payment & Delivery Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">حالة الدفع</label>
                <select
                  value={formData.payStatus}
                  onChange={(e: any) => setFormData({ ...formData, payStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="full">خالص بالكامل</option>
                  <option value="partial">دفع جزء</option>
                  <option value="none">لسه مدفعش حاجة</option>
                </select>
              </div>

              {formData.payStatus !== "none" && (
                <div>
                  <label className="text-xs font-bold text-muted block mb-1">طريقة الدفع</label>
                  <select
                    value={formData.method}
                    onChange={(e: any) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
                  >
                    <option value="cash">نقدي (كاش)</option>
                    <option value="wallet">محفظة إلكترونية</option>
                  </select>
                </div>
              )}

              {formData.payStatus === "partial" && (
                <div>
                  <label className="text-xs font-bold text-muted block mb-1">المبلغ المدفوع</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none font-mono"
                  />
                </div>
              )}
            </div>

            {/* Supplier purchasing method if external items exist */}
            {hasSupplierItems && (
              <div className="bg-accent-soft/30 border border-accent/20 p-3 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-bold text-accent-dark">
                  طريقة الشراء من المورد (للأصناف الجاية من برة):
                </span>
                <select
                  value={formData.purchMethod}
                  onChange={(e: any) => setFormData({ ...formData, purchMethod: e.target.value })}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-bold bg-white focus:border-accent outline-none"
                >
                  <option value="cash">نقدي (كاش)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                </select>
              </div>
            )}

            {formData.payStatus !== "full" && (
              <div className="text-xs text-muted font-bold">
                الباقي هيتسجل تلقائي في "الفلوس اللي لينا":{" "}
                <b className="text-danger font-mono">
                  {formatCurrency(
                    Math.max(
                      0,
                      previewSell - (formData.payStatus === "partial" ? Number(formData.paidAmount) || 0 : 0)
                    )
                  )}{" "}
                  ج.م
                </b>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDelivered}
                  onChange={(e) => setFormData({ ...formData, isDelivered: e.target.checked })}
                  className="rounded text-accent focus:ring-accent w-4 h-4"
                />
                <span>تم تسليم الأوردر للعميل</span>
              </label>

              <input
                type="text"
                placeholder="ملاحظات اختيارية عن الأوردر..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-1.5 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-6 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition shadow-sm"
              >
                {editingOrderId ? "حفظ التعديلات" : "حفظ الأوردر"}
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-border text-muted font-bold text-xs rounded-xl hover:bg-bg transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Orders List View */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted text-xs">لسه مفيش أوردرات مسجّلة</div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((o: any) => {
              const total = calculateOrderTotal(o.items);
              const paid = calculateOrderPaid(o.payments);
              const remaining = calculateOrderRemaining(o.items, o.payments);
              const missing = checkOrderMissingFields(o);
              const isOverdue = !o.isDelivered && daysBetween(o.orderDate) >= 10;

              return (
                <div
                  key={o.id}
                  className={`border rounded-2xl p-4 transition shadow-sm ${
                    o.isDelivered && missing.length === 0
                      ? "bg-sage-soft/30 border-sage/40"
                      : isOverdue
                      ? "bg-danger-soft/20 border-danger/40"
                      : "bg-surface border-border"
                  }`}
                >
                  {/* Order Card Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-ink">{o.customerName}</span>
                      {o.customerPhone && (
                        <span className="text-muted text-xs font-mono">({o.customerPhone})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted font-bold">{o.orderDate}</span>
                      <button
                        onClick={() => handleToggleDelivered(o)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                          o.isDelivered
                            ? "bg-sage-soft text-sage hover:bg-sage/20"
                            : "bg-danger-soft text-danger hover:bg-danger/20"
                        }`}
                      >
                        {o.isDelivered ? "تم التسليم" : "لسه ماتسلمش"}
                      </button>
                    </div>
                  </div>

                  {/* Items Blocks */}
                  <div className="space-y-2 mb-3">
                    {o.items.map((it: any, idx: number) => {
                      const itemSellTotal = it.qty * it.sellPrice;
                      const itemCostTotal = it.qty * it.costPrice;
                      const itemMargin = itemSellTotal - itemCostTotal;
                      const marginPct =
                        it.costPrice > 0 ? (itemMargin / itemCostTotal) * 100 : 0;

                      return (
                        <div
                          key={idx}
                          className="bg-bg border border-border/80 rounded-xl p-2.5 text-xs font-bold"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-ink">
                              {it.productName} ×{it.qty}
                            </span>
                            <span className="font-mono text-ink">
                              {formatCurrency(itemSellTotal)} ج.م
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted mt-1.5 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {it.source === "stock" ? (
                                <span className="bg-sage-soft text-sage px-1.5 py-0.5 rounded text-[10px]">
                                  من المخزون
                                </span>
                              ) : (
                                <span className="bg-accent-soft text-accent-dark px-1.5 py-0.5 rounded text-[10px]">
                                  شراء: {it.shopName || "محل غير محدد"}
                                </span>
                              )}
                              <span>تكلفة: {formatCurrency(it.costPrice)} ج.م</span>
                            </div>
                            <span className="text-sage font-extrabold">
                              مكسب: {formatCurrency(itemMargin)} ج.م ({formatCurrency(marginPct)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals & Status Pills */}
                  <div className="flex items-center justify-between gap-3 flex-wrap pt-2.5 border-t border-dashed border-border text-xs font-bold">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span>الإجمالي: {formatCurrency(total)} ج.م</span>
                      <span>المدفوع: {formatCurrency(paid)} ج.م</span>
                      <span className={remaining > 0 ? "text-danger" : "text-sage"}>
                        الباقي: {formatCurrency(remaining)} ج.م
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {remaining <= 0 ? (
                        <span className="bg-sage-soft text-sage px-2 py-0.5 rounded-full text-[11px]">
                          مدفوع بالكامل
                        </span>
                      ) : paid > 0 ? (
                        <span className="bg-accent-soft text-accent-dark px-2 py-0.5 rounded-full text-[11px]">
                          مدفوع جزئياً
                        </span>
                      ) : (
                        <span className="bg-danger-soft text-danger px-2 py-0.5 rounded-full text-[11px]">
                          غير مدفوع
                        </span>
                      )}

                      <span className="text-muted text-[11px]">
                        طريقة الدفع: {getMethodLabel(o.method)}
                      </span>
                    </div>
                  </div>

                  {missing.length > 0 && (
                    <div className="mt-2 text-danger bg-danger-soft px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>بيانات ناقصة: {missing.join("، ")}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60">
                    {remaining > 0 && (
                      <button
                        onClick={() =>
                          setPaymentModal({
                            open: true,
                            orderId: o.id,
                            customerName: o.customerName,
                            remaining,
                            amount: String(remaining),
                            method: "cash",
                          })
                        }
                        className="px-3 py-1 bg-sage-soft text-sage hover:bg-sage/20 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>تسجيل دفعة</span>
                      </button>
                    )}

                    <button
                      onClick={() => openEditOrder(o)}
                      className="px-3 py-1 bg-bg border border-border text-muted hover:text-ink rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>

                    <button
                      onClick={() => handleDeleteOrder(o.id)}
                      className="px-3 py-1 bg-danger-soft text-danger hover:bg-danger/20 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Installment Modal */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-warm-lg">
            <h3 className="text-base font-black text-ink mb-1">
              تسجيل دفعة — {paymentModal.customerName}
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
                <label className="text-xs font-bold text-muted block mb-1">طريقة الدفع *</label>
                <select
                  value={paymentModal.method}
                  onChange={(e: any) =>
                    setPaymentModal({ ...paymentModal, method: e.target.value })
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
                  تأكيد التحصيل
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

      {/* Day Closing Modal */}
      {dayClosingModal && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-base font-black text-ink">
                📋 قفلة اليوم — {dayClosingModal.date}
              </h3>
              <button
                onClick={() => setDayClosingModal(null)}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
              <div className="bg-bg p-3 rounded-xl border border-border">
                <span className="text-muted text-[11px] block">عدد الأوردرات</span>
                <span className="text-base font-black text-ink">
                  {dayClosingModal.orderCount}
                </span>
              </div>
              <div className="bg-bg p-3 rounded-xl border border-border">
                <span className="text-muted text-[11px] block">إجمالي البيع</span>
                <span className="text-base font-black text-ink">
                  {formatCurrency(dayClosingModal.totalSell)} ج.م
                </span>
              </div>
              <div className="bg-bg p-3 rounded-xl border border-border">
                <span className="text-muted text-[11px] block">تكلفة البضاعة المباعة</span>
                <span className="text-base font-black text-ink">
                  {formatCurrency(dayClosingModal.totalCost)} ج.م
                </span>
              </div>
              <div className="bg-bg p-3 rounded-xl border border-border">
                <span className="text-muted text-[11px] block">مجمل المكسب</span>
                <span className="text-base font-black text-sage">
                  {formatCurrency(dayClosingModal.grossMargin)} ج.م
                </span>
              </div>
              <div className="bg-bg p-3 rounded-xl border border-border">
                <span className="text-muted text-[11px] block">مشتريات مخزون جديدة</span>
                <span className="text-base font-black text-accent-dark">
                  {formatCurrency(dayClosingModal.newStockPurchases)} ج.م
                </span>
              </div>
              <div className="bg-bg p-3 rounded-xl border border-border">
                <span className="text-muted text-[11px] block">المصروفات</span>
                <span className="text-base font-black text-danger">
                  {formatCurrency(dayClosingModal.totalExpenses)} ج.م
                </span>
              </div>
            </div>

            <div className="bg-sage-soft border border-sage/30 p-3.5 rounded-xl text-center">
              <span className="text-xs text-muted font-bold block">صافي ربح اليوم الحقيقي</span>
              <span className="text-2xl font-black text-sage font-mono">
                {formatCurrency(dayClosingModal.netProfit)} ج.م
              </span>
            </div>

            <button
              onClick={() => setDayClosingModal(null)}
              className="w-full bg-ink text-white font-bold py-2 rounded-xl text-xs hover:bg-ink/90 transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
