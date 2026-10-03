import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, amount, date, note } = body;

    const trimmedName = (name || "").trim();
    const recAmount = Number(amount);

    if (!trimmedName || !(recAmount > 0)) {
      return NextResponse.json(
        { success: false, error: "يجب كتابة الاسم والمبلغ بشكل صحيح" },
        { status: 400 }
      );
    }

    const updated = await prisma.manualReceivable.update({
      where: { id },
      data: {
        name: trimmedName,
        amount: recAmount,
        date: date || new Date().toISOString().slice(0, 10),
        note: note ? note.trim() : null,
      },
    });

    return NextResponse.json({ success: true, receivable: updated });
  } catch (error: any) {
    console.error("Update manual receivable error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update receivable" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      const item = await tx.manualReceivable.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!item) throw new Error("المبلغ غير موجود");

      const cashEntries = await tx.cashLedger.findMany({
        where: { refType: "manualReceivable", refId: id },
      });

      await tx.trashRecord.create({
        data: {
          type: "manualReceivable",
          label: `فلوس لينا (يدوي): ${item.name} (${item.amount} ج.م)`,
          payload: JSON.stringify({ item, cashEntries }),
          deletedAt: new Date().toISOString().slice(0, 10),
        },
      });

      await tx.cashLedger.deleteMany({
        where: { refType: "manualReceivable", refId: id },
      });

      await tx.manualReceivable.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "تم نقل السند إلى سلة المحذوفات" });
  } catch (error: any) {
    console.error("Delete manual receivable error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete receivable" },
      { status: 500 }
    );
  }
}
