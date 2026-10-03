import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { type, method, amount, date, source } = body;

    const existing = await prisma.cashLedger.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "الحركة غير موجودة" }, { status: 404 });
    }

    if (existing.isAuto) {
      return NextResponse.json(
        {
          success: false,
          error: "الحركة دي تلقائية من عملية تانية (أوردر/شراء/مصروف)، لازم تعدّلها من مكانها الأصلي.",
        },
        { status: 400 }
      );
    }

    const cashAmount = Number(amount);
    if (!(cashAmount > 0)) {
      return NextResponse.json({ success: false, error: "المبلغ غير صحيح" }, { status: 400 });
    }

    const updated = await prisma.cashLedger.update({
      where: { id },
      data: {
        date: date || existing.date,
        type: type === "out" ? "out" : "in",
        method: method === "wallet" ? "wallet" : "cash",
        amount: cashAmount,
        source: (source || "").trim() || existing.source,
      },
    });

    return NextResponse.json({ success: true, entry: updated });
  } catch (error: any) {
    console.error("Update cash entry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update cash entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const existing = await prisma.cashLedger.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "الحركة غير موجودة" }, { status: 404 });
    }

    if (existing.isAuto) {
      return NextResponse.json(
        {
          success: false,
          error: "الحركة دي تلقائية من عملية تانية، احذفها من مكانها الأصلي (الأوردر/الشراء/المصروف).",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.trashRecord.create({
        data: {
          type: "cash",
          label: `${existing.type === "in" ? "وارد" : "صادر"}: ${existing.source} (${existing.amount} ج.م)`,
          payload: JSON.stringify({ cash: existing }),
          deletedAt: new Date().toISOString().slice(0, 10),
        },
      });

      await tx.cashLedger.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "تم نقل حركة الخزنة إلى سلة المحذوفات" });
  } catch (error: any) {
    console.error("Delete cash entry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete cash entry" },
      { status: 500 }
    );
  }
}
