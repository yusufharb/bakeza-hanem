"use client";

import React, { useState, useRef } from "react";
import { formatCurrency, todayStr } from "@/lib/utils";
import { calculateOrderTotal } from "@/lib/finance";
import { toPng } from "html-to-image";
import { Printer, Download, Share2, MessageSquare } from "lucide-react";

interface InvoiceTabProps {
  data: any;
}

export const InvoiceTab: React.FC<InvoiceTabProps> = ({ data }) => {
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const invoiceRef = useRef<HTMLDivElement>(null);

  const orders = data?.orders || [];
  const settings = data?.settings || {};
  const waNumber = settings.waNumber || "201124012072";

  // Group orders by customer and date
  const groups: Record<
    string,
    {
      customerName: string;
      customerCode?: string;
      customerPhone?: string;
      orderDate: string;
      orders: any[];
    }
  > = {};

  orders.forEach((o: any) => {
    const key = `${o.customerName.trim().toLowerCase()}|${o.orderDate}`;
    if (!groups[key]) {
      groups[key] = {
        customerName: o.customerName,
        customerCode: o.customer?.code,
        customerPhone: o.customerPhone || o.customer?.phone,
        orderDate: o.orderDate,
        orders: [],
      };
    }
    groups[key].orders.push(o);
  });

  const sortedGroups = Object.entries(groups).sort((a, b) =>
    b[1].orderDate.localeCompare(a[1].orderDate)
  );

  const activeGroup = selectedGroupKey ? groups[selectedGroupKey] : null;

  // Merge identical products with identical sellPrice
  const mergedItems: { productName: string; sellPrice: number; qty: number }[] = [];
  if (activeGroup) {
    const itemMap: Record<string, { productName: string; sellPrice: number; qty: number }> =
      {};
    activeGroup.orders.forEach((o) => {
      o.items.forEach((it: any) => {
        const itemKey = `${it.productName.trim().toLowerCase()}|${it.sellPrice}`;
        if (!itemMap[itemKey]) {
          itemMap[itemKey] = {
            productName: it.productName,
            sellPrice: Number(it.sellPrice),
            qty: 0,
          };
        }
        itemMap[itemKey].qty += Number(it.qty);
      });
    });
    mergedItems.push(...Object.values(itemMap));
  }

  const grandTotal = mergedItems.reduce((s, it) => s + it.qty * it.sellPrice, 0);

  // Pre-formatted WhatsApp text
  let waText = "";
  if (activeGroup) {
    waText = `فاتورة بكيزة هانم\nالعميل: ${activeGroup.customerName}\nالتاريخ: ${activeGroup.orderDate}\n---\n`;
    mergedItems.forEach((it) => {
      waText += `${it.productName} × ${it.qty} = ${formatCurrency(it.sellPrice * it.qty)} ج.م\n`;
    });
    waText += `---\nالإجمالي: ${formatCurrency(grandTotal)} ج.م`;
  }

  const handleDownloadImage = async () => {
    if (!invoiceRef.current) return;
    try {
      const dataUrl = await toPng(invoiceRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `فاتورة-بكيزة-هانم-${activeGroup?.customerName || todayStr()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert("فشل توليد صورة الفاتورة: " + err.message);
    }
  };

  const handleShareImage = async () => {
    if (!invoiceRef.current) return;
    try {
      const dataUrl = await toPng(invoiceRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `فاتورة-بكيزة-هانم-${activeGroup?.customerName}.png`, {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "فاتورة بكيزة هانم",
        });
      } else {
        // Fallback: download image
        const link = document.createElement("a");
        link.download = `فاتورة-بكيزة-هانم-${activeGroup?.customerName}.png`;
        link.href = dataUrl;
        link.click();
        alert("تم تحميل صورة الفاتورة على جهازك، يمكنك إرفاقها ومشاركتها عبر واتساب.");
      }
    } catch (err: any) {
      alert("تعذر المشاركة المباشرة: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <h2 className="text-base font-black text-ink mb-3 pb-2 border-b border-border">
          إصدار وطباعة فاتورة بيع
        </h2>

        {/* Order Selector */}
        <div className="max-w-md mb-6">
          <label className="text-xs font-bold text-muted block mb-1">
            اختاري العميل والتاريخ:
          </label>
          <select
            value={selectedGroupKey}
            onChange={(e) => setSelectedGroupKey(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-border rounded-xl text-xs font-bold bg-white focus:border-accent outline-none"
          >
            <option value="">-- اختاري عميلاً وتاريخاً --</option>
            {sortedGroups.map(([k, g]) => (
              <option key={k} value={k}>
                {g.customerName} - {g.orderDate}
                {g.orders.length > 1 ? ` (${g.orders.length} أوردرات مجمّعة)` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Render Invoice Preview */}
        {activeGroup ? (
          <div className="space-y-5">
            {/* The Branded Receipt Card (Capture Target) */}
            <div
              ref={invoiceRef}
              className="bg-white border border-border rounded-2xl p-8 max-w-[440px] mx-auto shadow-warm space-y-4 text-center"
            >
              {/* Logo / Badge */}
              <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-soft border border-accent/30 flex items-center justify-center font-cairo font-black text-accent-dark text-3xl shadow-sm">
                ب
              </div>

              <div>
                <h3 className="text-2xl font-black text-ink m-0 tracking-tight">بكيزة هانم</h3>
                <div className="text-accent-dark text-xs font-extrabold mt-0.5">فاتورة بيع</div>
              </div>

              {/* Customer & Date Headers */}
              <div className="border-t border-b border-dashed border-border py-2.5 text-xs font-bold text-ink space-y-1 text-right">
                <div className="flex justify-between">
                  <span className="text-muted">العميل:</span>
                  <span className="font-black">
                    {activeGroup.customerName}
                    {activeGroup.customerCode && (
                      <span className="font-mono text-accent-dark mr-1">
                        ({activeGroup.customerCode})
                      </span>
                    )}
                  </span>
                </div>
                {activeGroup.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted">الموبايل:</span>
                    <span className="font-mono">{activeGroup.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">التاريخ:</span>
                  <span>{activeGroup.orderDate}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-dashed divide-border text-xs font-bold text-right">
                {mergedItems.map((it, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center">
                    <span className="text-ink">
                      {it.productName} <span className="text-muted font-normal">×{it.qty}</span>
                    </span>
                    <span className="font-mono text-ink">
                      {formatCurrency(it.sellPrice * it.qty)} ج.م
                    </span>
                  </div>
                ))}
              </div>

              {/* Grand Total */}
              <div className="border-t-2 border-border pt-3 flex justify-between items-center font-black">
                <span className="text-base text-ink">الإجمالي النهائي</span>
                <span className="text-xl font-mono text-accent-dark">
                  {formatCurrency(grandTotal)} ج.م
                </span>
              </div>

              <div className="text-[11px] text-muted pt-2 border-t border-border/40 font-medium">
                شكراً لتسوقك من بكيزة هانم 💖
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-2">
              <button
                onClick={handleShareImage}
                className="px-4 py-2 bg-[#25D366] text-white font-bold text-xs rounded-xl hover:bg-[#1fb857] transition flex items-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>📷 إرسال الفاتورة كصورة (واتساب)</span>
              </button>

              <button
                onClick={handleDownloadImage}
                className="px-4 py-2 bg-accent-soft text-accent-dark font-bold text-xs rounded-xl hover:bg-accent/20 transition flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>⬇ تحميل الفاتورة كصورة</span>
              </button>

              <a
                href={`https://wa.me/${
                  activeGroup.customerPhone?.replace(/\D/g, "") || waNumber
                }?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 border border-border text-muted hover:text-ink font-bold text-xs rounded-xl hover:bg-bg transition flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                <span>✉️ إرسال نص بس (واتساب)</span>
              </a>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-border text-muted hover:text-ink font-bold text-xs rounded-xl hover:bg-bg transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>🖨 طباعة</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted text-xs">
            اختار عميلاً وتاريخاً من القائمة أعلاه لعرض فاتورة البيع
          </div>
        )}
      </div>
    </div>
  );
};
