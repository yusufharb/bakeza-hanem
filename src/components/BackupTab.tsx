"use client";

import React, { useState } from "react";
import { formatCurrency, todayStr } from "@/lib/utils";
import * as XLSX from "xlsx";
import { Download, Upload, Share2, FileSpreadsheet, Printer, ShieldAlert, Trash2 } from "lucide-react";

interface BackupTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const BackupTab: React.FC<BackupTabProps> = ({ data, onRefresh }) => {
  const [dataCheckIssues, setDataCheckIssues] = useState<string[] | null>(null);

  const products = data?.products || [];
  const orders = data?.orders || [];
  const purchases = data?.purchases || [];
  const expenses = data?.expenses || [];
  const cashEntries = data?.cashEntries || [];
  const manualReceivables = data?.manualReceivables || [];
  const manualPayables = data?.manualPayables || [];

  const markBackupDone = async () => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "lastBackup", value: todayStr() }),
      });
      await onRefresh();
    } catch (e) {}
  };

  const handleExportJSON = () => {
    const exportPayload = {
      version: "BakezaHanemV9",
      exportedAt: new Date().toISOString(),
      products: data.products,
      orders: data.orders,
      purchases: data.purchases,
      expenses: data.expenses,
      cash: data.cashEntries,
      manualReceivables: data.manualReceivables,
      manualPayables: data.manualPayables,
      customers: data.customers,
      trash: data.trash,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bakiza-hanem-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markBackupDone();
  };

  const handleShareJSON = async () => {
    const exportPayload = {
      version: "BakezaHanemV9",
      exportedAt: new Date().toISOString(),
      products: data.products,
      orders: data.orders,
      purchases: data.purchases,
      expenses: data.expenses,
      cash: data.cashEntries,
      manualReceivables: data.manualReceivables,
      manualPayables: data.manualPayables,
      customers: data.customers,
      trash: data.trash,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const file = new File([blob], `bakiza-hanem-backup-${todayStr()}.json`, {
      type: "application/json",
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "نسخة احتياطية بكيزة هانم",
        });
        markBackupDone();
        return;
      } catch (e) {}
    }

    handleExportJSON();
    alert("تم تحميل النسخة على جهازك، يمكنك إرسالها يدوياً عبر واتساب.");
  };

  const handleImportFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (
          !confirm(
            "⚠️ تنبيه: استيراد النسخة دي هيستبدل كل البيانات الحالية بقاعدة البيانات. متأكد من المتابعة؟"
          )
        ) {
          return;
        }

        const res = await fetch("/api/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        alert("تم استيراد النسخة الاحتياطية بنجاح ✅");
        await onRefresh();
      } catch (err: any) {
        alert("ملف النسخة الاحتياطية غير صالح: " + err.message);
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Orders Sheet
      const ordersRows: any[] = [];
      orders.forEach((o: any) => {
        const total = o.items.reduce((s: number, it: any) => s + it.qty * it.sellPrice, 0);
        const paid = o.payments.reduce((s: number, p: any) => s + p.amount, 0);
        const rem = Math.max(0, total - paid);

        o.items.forEach((it: any) => {
          ordersRows.push({
            التاريخ: o.orderDate,
            العميل: o.customerName,
            الموبايل: o.customerPhone || "-",
            المنتج: it.productName,
            الكمية: it.qty,
            "سعر البيع": it.sellPrice,
            "سعر الشراء": it.costPrice,
            المصدر: it.source === "stock" ? "من المخزون" : it.shopName || "-",
            "إجمالي الأوردر": total,
            "المدفوع": paid,
            "الباقي": rem,
            "تم التسليم": o.isDelivered ? "نعم" : "لا",
          });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersRows), "الأوردرات");

      // 2. Inventory Sheet
      const invRows = products.map((p: any) => ({
        الكود: p.code,
        الاسم: p.name,
        "متوسط التكلفة": p.avgCost || p.currentAvgCost || 0,
        "سعر البيع": p.sellingPrice,
        "الكمية المتاحة": p.stock || 0,
        "قيمة المخزون": (p.stock || 0) * (p.avgCost || p.currentAvgCost || 0),
        "الحالة": p.isActive ? "نشط" : "مؤرشف",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), "المخزون");

      // 3. Purchases Sheet
      const purRows = purchases.map((pu: any) => {
        const paid = pu.payments.reduce((s: number, p: any) => s + p.amount, 0);
        return {
          التاريخ: pu.purchaseDate,
          الصنف: pu.product?.name || "-",
          المحل: pu.supplier,
          الكمية: pu.qty,
          "سعر الوحدة": pu.unitCost,
          الإجمالي: pu.totalCost,
          المدفوع: paid,
          الباقي: Math.max(0, pu.totalCost - paid),
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purRows), "المشتريات");

      // 4. Expenses Sheet
      const expRows = expenses.map((e: any) => ({
        التاريخ: e.date,
        السبب: e.reason,
        المبلغ: e.amount,
        الطريقة: e.method === "wallet" ? "محفظة" : "نقدي",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), "المصروفات");

      // 5. Cash Sheet
      const cashRows = cashEntries.map((c: any) => ({
        التاريخ: c.date,
        النوع: c.type === "in" ? "وارد" : "صادر",
        الطريقة: c.method === "wallet" ? "محفظة" : "نقدي",
        المبلغ: c.amount,
        البيان: c.source || "-",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cashRows), "الخزنة");

      XLSX.writeFile(wb, `bakiza-hanem-${todayStr()}.xlsx`);
      markBackupDone();
    } catch (err: any) {
      alert("فشل تصدير Excel: " + err.message);
    }
  };

  const runDataCheck = () => {
    const issues: string[] = [];
    products.forEach((p: any) => {
      if (p.stock < 0) {
        issues.push(`المنتج "${p.name}" مخزونه سالب (${p.stock}) — يعني اتباعت منه كمية أكتر من المسجل شرائها.`);
      }
    });

    orders.forEach((o: any) => {
      if (!o.orderDate) issues.push(`أوردر للعميل "${o.customerName}" من غير تاريخ.`);
      if (!o.customerName?.trim()) issues.push(`أوردر مسجل من غير اسم عميل (تاريخ ${o.orderDate}).`);
      o.items?.forEach((it: any, i: number) => {
        if (!(it.sellPrice > 0)) {
          issues.push(
            `أوردر "${o.customerName}" — الصنف "${it.productName || `#${i + 1}`}" سعر بيعه صفر.`
          );
        }
        if (it.source === "supplier" && !(it.costPrice > 0)) {
          issues.push(
            `أوردر "${o.customerName}" — الصنف "${it.productName || `#${i + 1}`}" سعر شرائه صفر.`
          );
        }
      });
    });

    purchases.forEach((pu: any) => {
      if (!(pu.unitCost > 0)) {
        issues.push(`عملية شراء من "${pu.supplier}" سعر الوحدة فيها صفر.`);
      }
    });

    setDataCheckIssues(issues);
  };

  const handleResetAll = async () => {
    if (
      !confirm("⚠️ تحذير نهائي خطير: هيتم مسح كل البيانات نهائياً وتصفير قاعدة البيانات. متأكد؟")
    ) {
      return;
    }
    if (!confirm("تأكيد أخير: هل تريد مسح كل شيء؟ لا يمكن التراجع!")) {
      return;
    }

    try {
      const res = await fetch("/api/backup", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      alert("تم مسح كافة البيانات وتصفير النظام بنجاح.");
      await onRefresh();
    } catch (err: any) {
      alert("فشل مسح البيانات: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Backup & Export Panel */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <h2 className="text-base font-black text-ink mb-2">النسخ الاحتياطي وتصدير البيانات</h2>
        <p className="text-xs text-muted mb-4">
          يتم حفظ بيانات المتجر محلياً داخل قاعدة بيانات آمنة. يفضل تصدير نسخة احتياطية دورياً وحفظها على هاتفك أو جهاز خارجي.
        </p>

        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent-dark transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>⬇ تصدير نسخة كاملة (JSON)</span>
          </button>

          <button
            onClick={handleShareJSON}
            className="px-4 py-2 bg-[#25D366] text-white font-bold text-xs rounded-xl hover:bg-[#1fb857] transition flex items-center gap-1.5 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>📤 حفظ + إرسال واتساب</span>
          </button>

          <label className="px-4 py-2 bg-accent-soft text-accent-dark font-bold text-xs rounded-xl hover:bg-accent/20 transition flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>⬆ استيراد نسخة احتياطية</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap pt-3 border-t border-border/60">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-sage-soft text-sage font-bold text-xs rounded-xl hover:bg-sage/20 transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>📊 تصدير Excel (متعدد أوراق العمل)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-sage-soft text-sage font-bold text-xs rounded-xl hover:bg-sage/20 transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>📄 تقرير عام للطباعة / PDF</span>
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-danger/20 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span className="text-xs font-bold text-danger block">تصفير النظام ومسح البيانات</span>
            <span className="text-[11px] text-muted">
              حذف كافة الأوردرات والمنتجات والمشتريات والخزينة نهائياً
            </span>
          </div>

          <button
            onClick={handleResetAll}
            className="px-4 py-2 bg-danger-soft text-danger hover:bg-danger/20 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>🗑 مسح كل البيانات نهائياً</span>
          </button>
        </div>
      </div>

      {/* Data Consistency Check Panel */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-accent" />
            <h2 className="text-base font-black text-ink">فحص سلامة واتساق البيانات</h2>
          </div>

          <button
            onClick={runDataCheck}
            className="px-4 py-1.5 bg-accent-soft text-accent-dark font-bold text-xs rounded-xl hover:bg-accent/20 transition"
          >
            🔍 افحص بياناتي الآن
          </button>
        </div>

        {dataCheckIssues === null ? (
          <p className="text-xs text-muted">
            اضغط زر "افحص بياناتي" للكشف التلقائي عن أي أخطاء في المخزون السالب، أو أسعار البيع الصفرية، أو التواريخ المفقودة.
          </p>
        ) : dataCheckIssues.length === 0 ? (
          <div className="bg-sage-soft text-sage p-3.5 rounded-xl border border-sage/30 text-xs font-bold">
            ✅ ممتاز! مفيش أي مشاكل أو بيانات غير متسقة في حساباتك حالياً.
          </div>
        ) : (
          <div className="bg-danger-soft/40 border border-danger/30 rounded-xl p-3.5 space-y-2">
            <span className="text-xs font-black text-danger block">
              ⚠️ تم رصد {dataCheckIssues.length} ملاحظات تحتاج إلى مراجعة:
            </span>
            <div className="divide-y divide-danger/20 text-xs font-bold text-danger">
              {dataCheckIssues.map((issue, idx) => (
                <div key={idx} className="py-1.5">
                  • {issue}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
