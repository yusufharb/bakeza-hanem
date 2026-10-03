"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr } from "@/lib/utils";
import {
  calculateOrderTotal,
  calculateOrderCostTotal,
  calculatePurchaseTotal,
} from "@/lib/finance";
import { BarChart3, TrendingUp, Lightbulb, User, Package, Store } from "lucide-react";

interface ReportsTabProps {
  data: any;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ data }) => {
  const [reportMode, setReportMode] = useState<"summary" | "detailed">("summary");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Detailed filters
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterPlace, setFilterPlace] = useState("");

  // Work analysis toggle
  const [showWorkAnalysis, setShowWorkAnalysis] = useState(false);

  const orders = data?.orders || [];
  const purchases = data?.purchases || [];
  const expenses = data?.expenses || [];
  const products = data?.products || [];

  // Filter by date range
  const filteredOrders = orders.filter(
    (o: any) => (!fromDate || o.orderDate >= fromDate) && (!toDate || o.orderDate <= toDate)
  );
  const filteredPurchases = purchases.filter(
    (p: any) => (!fromDate || p.purchaseDate >= fromDate) && (!toDate || p.purchaseDate <= toDate)
  );
  const filteredExpenses = expenses.filter(
    (e: any) => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate)
  );

  // Summary Metrics
  const totalSell = filteredOrders.reduce(
    (sum: number, o: any) => sum + calculateOrderTotal(o.items),
    0
  );
  const totalCostOfSold = filteredOrders.reduce(
    (sum: number, o: any) => sum + calculateOrderCostTotal(o.items),
    0
  );
  const grossMargin = totalSell - totalCostOfSold;
  const marginPct = totalCostOfSold > 0 ? (grossMargin / totalCostOfSold) * 100 : 0;
  const totalExpenses = filteredExpenses.reduce(
    (sum: number, e: any) => sum + Number(e.amount || 0),
    0
  );
  const netProfit = grossMargin - totalExpenses;
  const totalPurchaseSpend = filteredPurchases.reduce(
    (sum: number, p: any) => sum + calculatePurchaseTotal(p.unitCost, p.qty),
    0
  );

  // Top Product in period
  const prodQty: Record<string, number> = {};
  filteredOrders.forEach((o: any) => {
    o.items.forEach((it: any) => {
      prodQty[it.productName] = (prodQty[it.productName] || 0) + Number(it.qty || 1);
    });
  });
  let topProduct = "-";
  let topProductQty = 0;
  Object.entries(prodQty).forEach(([name, qty]) => {
    if (qty > topProductQty) {
      topProduct = name;
      topProductQty = qty;
    }
  });

  // Top Customer in period
  const custSpend: Record<string, number> = {};
  filteredOrders.forEach((o: any) => {
    custSpend[o.customerName] =
      (custSpend[o.customerName] || 0) + calculateOrderTotal(o.items);
  });
  let topCustomer = "-";
  let topCustomerSpend = 0;
  Object.entries(custSpend).forEach(([name, spend]) => {
    if (spend > topCustomerSpend) {
      topCustomer = name;
      topCustomerSpend = spend;
    }
  });

  // Top Place / Supplier in period
  const placeQty: Record<string, number> = {};
  filteredPurchases.forEach((p: any) => {
    placeQty[p.supplier] = (placeQty[p.supplier] || 0) + Number(p.qty || 1);
  });
  filteredOrders.forEach((o: any) => {
    o.items.forEach((it: any) => {
      if (it.source === "supplier" && it.shopName) {
        placeQty[it.shopName] = (placeQty[it.shopName] || 0) + Number(it.qty || 1);
      }
    });
  });
  let topPlace = "-";
  let topPlaceQty = 0;
  Object.entries(placeQty).forEach(([name, qty]) => {
    if (qty > topPlaceQty) {
      topPlace = name;
      topPlaceQty = qty;
    }
  });

  // Dynamic Strategic Advice Tips
  const tips: string[] = [];
  const lowStock = products.filter(
    (p: any) => p.minStock > 0 && p.stock <= p.minStock
  );
  if (topProduct !== "-" && lowStock.some((p: any) => p.name === topProduct)) {
    tips.push(
      `المنتج "${topProduct}" هو الأكثر مبيعاً ومخزونه قرب يخلص — يفضل تطلب منه كمية جديدة قريباً.`
    );
  }
  if (totalSell > 0 && grossMargin / totalSell < 0.15) {
    tips.push(
      `هامش الربح في هذه الفترة أقل من 15% من إجمالي البيع — يفضل مراجعة أسعار البيع أو تكلفة الشراء.`
    );
  }
  if (topCustomer !== "-" && topCustomerSpend > 0) {
    tips.push(
      `العميل "${topCustomer}" هو الأكثر شراءً في الفترة دي (${formatCurrency(
        topCustomerSpend
      )} ج.م) — يستاهل اهتمام زيادة أو عرض خاص.`
    );
  }
  if (netProfit < 0) {
    tips.push(`صافي الربح سالب في الفترة دي — المصروفات أكبر من المكسب، يستاهل مراجعة فورية.`);
  }
  if (tips.length === 0) {
    tips.push("أداء المتجر مستقر في هذه الفترة دون مؤشرات مقلقة.");
  }

  // Detailed rows
  const detailedRows: {
    date: string;
    customer: string;
    product: string;
    qty: number;
    sell: number;
    cost: number;
    place: string;
    pct: number;
  }[] = [];

  filteredOrders.forEach((o: any) => {
    if (
      filterCustomer.trim() &&
      !o.customerName.toLowerCase().includes(filterCustomer.trim().toLowerCase())
    ) {
      return;
    }
    o.items.forEach((it: any) => {
      if (
        filterProduct.trim() &&
        !it.productName.toLowerCase().includes(filterProduct.trim().toLowerCase())
      ) {
        return;
      }
      const place = it.source === "stock" ? "من المخزون" : it.shopName || "-";
      if (
        filterPlace.trim() &&
        !place.toLowerCase().includes(filterPlace.trim().toLowerCase())
      ) {
        return;
      }
      const itemMargin = it.sellPrice - it.costPrice;
      const pct = it.costPrice > 0 ? (itemMargin / it.costPrice) * 100 : 0;

      detailedRows.push({
        date: o.orderDate,
        customer: o.customerName,
        product: it.productName,
        qty: it.qty,
        sell: it.sellPrice,
        cost: it.costPrice,
        place,
        pct,
      });
    });
  });

  const detailedTotalQty = detailedRows.reduce((s, r) => s + r.qty, 0);
  const detailedTotalSell = detailedRows.reduce((s, r) => s + r.sell * r.qty, 0);
  const detailedTotalCost = detailedRows.reduce((s, r) => s + r.cost * r.qty, 0);
  const detailedOverallMargin = detailedTotalSell - detailedTotalCost;
  const detailedOverallPct =
    detailedTotalCost > 0 ? (detailedOverallMargin / detailedTotalCost) * 100 : 0;

  // Work Analysis (All-Time)
  const monthTotals: Record<string, number> = {};
  orders.forEach((o: any) => {
    const monthKey = o.orderDate?.slice(0, 7) || "غير محدد";
    const margin = calculateOrderTotal(o.items) - calculateOrderCostTotal(o.items);
    monthTotals[monthKey] = (monthTotals[monthKey] || 0) + margin;
  });
  let bestMonth = "-";
  let bestMonthMargin = -Infinity;
  Object.entries(monthTotals).forEach(([m, margin]) => {
    if (margin > bestMonthMargin) {
      bestMonthMargin = margin;
      bestMonth = m;
    }
  });
  const bestMonthOrdersCount = orders.filter(
    (o: any) => o.orderDate?.slice(0, 7) === bestMonth
  ).length;

  const allTimeProdQty: Record<string, number> = {};
  orders.forEach((o: any) => {
    o.items.forEach((it: any) => {
      allTimeProdQty[it.productName] =
        (allTimeProdQty[it.productName] || 0) + Number(it.qty || 1);
    });
  });
  let allTimeTopProduct = "-";
  let allTimeTopProductQty = 0;
  Object.entries(allTimeProdQty).forEach(([name, qty]) => {
    if (qty > allTimeTopProductQty) {
      allTimeTopProduct = name;
      allTimeTopProductQty = qty;
    }
  });

  const allTimeCustSpend: Record<string, number> = {};
  orders.forEach((o: any) => {
    allTimeCustSpend[o.customerName] =
      (allTimeCustSpend[o.customerName] || 0) + calculateOrderTotal(o.items);
  });
  let allTimeTopCustomer = "-";
  let allTimeTopCustomerSpend = 0;
  Object.entries(allTimeCustSpend).forEach(([name, spend]) => {
    if (spend > allTimeTopCustomerSpend) {
      allTimeTopCustomer = name;
      allTimeTopCustomerSpend = spend;
    }
  });

  const drillToProduct = (productName: string) => {
    setReportMode("detailed");
    setFilterProduct(productName);
    setFilterCustomer("");
    setFilterPlace("");
  };

  const drillToCustomer = (customerName: string) => {
    setReportMode("detailed");
    setFilterCustomer(customerName);
    setFilterProduct("");
    setFilterPlace("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h2 className="text-base font-black text-ink">التقارير المالية وتحليل الأداء</h2>
          </div>

          <button
            onClick={() => setShowWorkAnalysis(!showWorkAnalysis)}
            className="px-3.5 py-1.5 bg-accent-soft text-accent-dark font-bold text-xs rounded-xl hover:bg-accent/20 transition flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{showWorkAnalysis ? "إخفاء تحليل الشغل" : "📊 تحليل الشغل التراكمي"}</span>
          </button>
        </div>

        {/* Work Analysis Banner */}
        {showWorkAnalysis && (
          <div className="bg-bg border border-border rounded-2xl p-4 mb-5 space-y-3 animate-in fade-in">
            <h3 className="text-xs font-black text-ink">
              📊 تحليل الشغل التراكمي (على مدار كل البيانات المسجلة)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-border">
                <span className="text-muted text-[11px] font-bold block">
                  أفضل شهر (بالمكسب)
                </span>
                <span className="text-sm font-black text-ink block mt-1">
                  {bestMonth}
                </span>
                <span className="text-[11px] text-sage font-bold">
                  {bestMonthOrdersCount} أوردر — مكسب {formatCurrency(bestMonthMargin)} ج.م
                </span>
              </div>

              <div
                onClick={() => drillToProduct(allTimeTopProduct)}
                className="bg-white p-3.5 rounded-xl border border-border cursor-pointer hover:border-accent/40 transition"
              >
                <span className="text-muted text-[11px] font-bold block">
                  أكتر منتج مبيعاً على الإطلاق (انقر للتفاصيل)
                </span>
                <span className="text-sm font-black text-ink block mt-1">
                  {allTimeTopProduct}
                </span>
                <span className="text-[11px] text-accent-dark font-bold">
                  إجمالي المباع: {allTimeTopProductQty} قطعة
                </span>
              </div>

              <div
                onClick={() => drillToCustomer(allTimeTopCustomer)}
                className="bg-white p-3.5 rounded-xl border border-border cursor-pointer hover:border-accent/40 transition"
              >
                <span className="text-muted text-[11px] font-bold block">
                  أكتر عميل شراءً على الإطلاق (انقر للتفاصيل)
                </span>
                <span className="text-sm font-black text-ink block mt-1">
                  {allTimeTopCustomer}
                </span>
                <span className="text-[11px] text-sage font-bold">
                  إجمالي إنفاقه: {formatCurrency(allTimeTopCustomerSpend)} ج.م
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-xs font-bold text-muted block mb-1">نوع التقرير</label>
            <select
              value={reportMode}
              onChange={(e: any) => setReportMode(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
            >
              <option value="summary">تقرير إجمالي (الملخص العام والمؤشرات)</option>
              <option value="detailed">تقرير تفصيلي (سجل كل حركة مبيعات)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted block mb-1">من تاريخ</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted block mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
            />
          </div>
        </div>

        {/* Detailed Secondary Filters */}
        {reportMode === "detailed" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-3 bg-bg rounded-xl border border-border animate-in fade-in">
            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                فلتر باسم العميل
              </label>
              <input
                type="text"
                placeholder="ابحث بالعميل..."
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold bg-white focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                فلتر باسم المنتج
              </label>
              <input
                type="text"
                placeholder="ابحث بالمنتج..."
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold bg-white focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                فلتر بالمحل أو المكان
              </label>
              <input
                type="text"
                placeholder="ابحث بالمحل..."
                value={filterPlace}
                onChange={(e) => setFilterPlace(e.target.value)}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-bold bg-white focus:border-accent outline-none"
              />
            </div>
          </div>
        )}

        {/* SUMMARY MODE CONTENT */}
        {reportMode === "summary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-bg p-3.5 rounded-xl border border-border text-center">
                <span className="text-[11px] text-muted font-bold block">عدد الأوردرات</span>
                <span className="text-xl font-black text-ink">{filteredOrders.length}</span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border text-center">
                <span className="text-[11px] text-muted font-bold block">إجمالي البيع</span>
                <span className="text-xl font-black text-ink">
                  {formatCurrency(totalSell)} ج.م
                </span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border text-center">
                <span className="text-[11px] text-muted font-bold block">تكلفة المباع</span>
                <span className="text-xl font-black text-ink">
                  {formatCurrency(totalCostOfSold)} ج.م
                </span>
              </div>
              <div className="bg-bg p-3.5 rounded-xl border border-border text-center">
                <span className="text-[11px] text-muted font-bold block">
                  المكسب (قبل المصروفات)
                </span>
                <span className="text-xl font-black text-sage">
                  {formatCurrency(grossMargin)} ج.م{" "}
                  <span className="text-xs text-muted">({formatCurrency(marginPct)}%)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-bg p-3.5 rounded-xl border border-border text-center">
                <span className="text-[11px] text-muted font-bold block">إجمالي المصروفات</span>
                <span className="text-lg font-black text-danger">
                  {formatCurrency(totalExpenses)} ج.م
                </span>
              </div>

              <div className="bg-sage-soft p-3.5 rounded-xl border border-sage/30 text-center">
                <span className="text-[11px] text-muted font-bold block">صافي الربح</span>
                <span className="text-2xl font-black text-sage">
                  {formatCurrency(netProfit)} ج.م
                </span>
              </div>

              <div className="bg-bg p-3.5 rounded-xl border border-border text-center">
                <span className="text-[11px] text-muted font-bold block">
                  مشتريات مخزون جديدة
                </span>
                <span className="text-lg font-black text-accent-dark">
                  {formatCurrency(totalPurchaseSpend)} ج.م
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                onClick={() => drillToProduct(topProduct)}
                className="bg-bg p-3.5 rounded-xl border border-border cursor-pointer hover:border-accent/40 transition"
              >
                <span className="text-[11px] text-muted font-bold block flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-accent" />
                  <span>أكتر منتج مبيعاً (اضغط للتفاصيل)</span>
                </span>
                <span className="text-sm font-black text-ink block mt-1">
                  {topProduct} {topProductQty > 0 && `(${topProductQty} قطعة)`}
                </span>
              </div>

              <div
                onClick={() => drillToCustomer(topCustomer)}
                className="bg-bg p-3.5 rounded-xl border border-border cursor-pointer hover:border-accent/40 transition"
              >
                <span className="text-[11px] text-muted font-bold block flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-sage" />
                  <span>أكتر عميل اشترى (اضغط للتفاصيل)</span>
                </span>
                <span className="text-sm font-black text-ink block mt-1">
                  {topCustomer} {topCustomerSpend > 0 && `(${formatCurrency(topCustomerSpend)} ج.م)`}
                </span>
              </div>

              <div className="bg-bg p-3.5 rounded-xl border border-border">
                <span className="text-[11px] text-muted font-bold block flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-accent-dark" />
                  <span>أكتر مكان بتشتري منه</span>
                </span>
                <span className="text-sm font-black text-ink block mt-1">
                  {topPlace} {topPlaceQty > 0 && `(${topPlaceQty} قطعة)`}
                </span>
              </div>
            </div>

            {/* Smart Advice Panel */}
            <div className="bg-bg border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-black text-ink flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-accent" />
                <span>💡 نصائح تشغيلية ذكية</span>
              </h3>
              <div className="space-y-1.5 text-xs font-bold text-ink">
                {tips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DETAILED MODE CONTENT */}
        {reportMode === "detailed" && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-right text-xs">
              <thead className="bg-bg text-muted border-b border-border font-bold">
                <tr>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">العميل</th>
                  <th className="py-2.5 px-3">المنتج</th>
                  <th className="py-2.5 px-3">الكمية</th>
                  <th className="py-2.5 px-3">سعر البيع</th>
                  <th className="py-2.5 px-3">سعر الشراء</th>
                  <th className="py-2.5 px-3">نسبة المكسب</th>
                  <th className="py-2.5 px-3">المكان / المصدر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-white font-bold">
                {detailedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted">
                      مفيش نتائج تطابق الفلتر المحدد
                    </td>
                  </tr>
                ) : (
                  detailedRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-bg/40 transition">
                      <td className="py-2.5 px-3 text-muted">{r.date}</td>
                      <td className="py-2.5 px-3 text-ink">{r.customer}</td>
                      <td className="py-2.5 px-3 text-ink">{r.product}</td>
                      <td className="py-2.5 px-3 font-mono">{r.qty}</td>
                      <td className="py-2.5 px-3 font-mono">{formatCurrency(r.sell)} ج.م</td>
                      <td className="py-2.5 px-3 font-mono text-muted">
                        {formatCurrency(r.cost)} ج.م
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sage">
                        {formatCurrency(r.pct)}%
                      </td>
                      <td className="py-2.5 px-3 text-muted">{r.place}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {detailedRows.length > 0 && (
                <tfoot className="bg-bg font-black text-ink border-t-2 border-border">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3">
                      الإجمالي
                    </td>
                    <td className="py-2.5 px-3 font-mono">{detailedTotalQty}</td>
                    <td className="py-2.5 px-3 font-mono text-accent-dark">
                      {formatCurrency(detailedTotalSell)} ج.م
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted">
                      {formatCurrency(detailedTotalCost)} ج.م
                    </td>
                    <td className="py-2.5 px-3 font-mono text-sage">
                      {formatCurrency(detailedOverallPct)}%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
