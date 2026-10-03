import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, amount, date, note } = body;

    const trimmedName = (name || "").trim();
    const payAmount = Number(amount);

    if (!trimmedName || !(payAmount > 0)) {
      return NextResponse.json(
        { success: false, error: "يجب كتابة الجهة والمبلغ بشكل صحيح" },
        { status: 400 }
      );
    }

    const updated = await prisma.manualPayable.update({
      where: { id },
      data: {
        name: trimmedName,
        amount: payAmount,
        date: date || new Date().toISOString().slice(0, 10),
        note: note ? note.trim() : null,
      },
    });

    return NextResponse.json({ success: true, payable: updated });
  } catch (error: any) {
    console.error("Update manual payable error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update payable" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      const item = await tx.manualPayable.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!item) throw new Error("المبلغ غير موجود");

      const cashEntries = await tx.cashLedger.findMany({
        where: { refType: "manualPayable", refId: id },
      });

      await tx.trashRecord.create({
        data: {
          type: "manualPayable",
          label: `فلوس علينا (يدوي): ${item.name} (${item.amount} ج.م)`,
          payload: JSON.stringify({ item, cashEntries }),
          deletedAt: new Date().toISOString().slice(0, 10),
        },
      });

      await tx.cashLedger.deleteMany({
        where: { refType: "manualPayable", refId: id },
      });

      await tx.manualPayable.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "تم نقل السند إلى سلة المحذوفات" });
  } catch (error: any) {
    console.error("Delete manual payable error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete payable" },
      { status: 500 }
    );
  }
}
