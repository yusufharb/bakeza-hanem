"use client";

import React from "react";
import { RotateCcw, Trash2 } from "lucide-react";

interface TrashTabProps {
  data: any;
  onRefresh: () => Promise<void>;
}

export const TrashTab: React.FC<TrashTabProps> = ({ data, onRefresh }) => {
  const trash = data?.trash || [];

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert("فشل استرجاع العنصر: " + err.message);
    }
  };

  const handleEmptyTrash = async () => {
    if (trash.length === 0) {
      alert("السلة فاضية أصلاً");
      return;
    }
    if (
      !confirm("سيتم مسح كل محتويات السلة نهائياً دون أي إمكانية للرجوع. متأكد من المتابعة؟")
    ) {
      return;
    }

    try {
      const res = await fetch("/api/trash", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await onRefresh();
    } catch (err: any) {
      alert("فشل إفراغ السلة: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-warm">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-base font-black text-ink">سلة المحذوفات</h2>
          <button
            onClick={handleEmptyTrash}
            className="px-4 py-2 bg-danger-soft text-danger hover:bg-danger/20 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>🗑 إفراغ السلة نهائياً</span>
          </button>
        </div>

        <p className="text-xs text-muted mb-4">
          أي عنصر تحذفه من البرنامج (أوردر، شراء، صنف، مصروف، حركة خزينة) ينتقل إلى هنا أولاً، وتقدر تسترجعه في أي وقت بكامل قيوده المالية.
        </p>

        {trash.length === 0 ? (
          <div className="text-center py-12 text-muted text-xs font-bold">
            السلة فاضية حالياً ✨
          </div>
        ) : (
          <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden bg-white">
            {trash.map((t: any) => (
              <div
                key={t.id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs font-bold hover:bg-bg/40 transition"
              >
                <div>
                  <span className="text-ink text-sm block mb-0.5">{t.label}</span>
                  <span className="text-[11px] text-muted">
                    تاريخ الحذف: {t.deletedAt} • النوع: {t.type}
                  </span>
                </div>

                <button
                  onClick={() => handleRestore(t.id)}
                  className="px-3 py-1.5 bg-sage-soft text-sage hover:bg-sage/20 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>↩ استرجاع</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
