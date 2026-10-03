import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { date, amount, reason, method } = body;

    const expenseAmount = Number(amount);
    const trimmedReason = (reason || "").trim();

    if (!(expenseAmount > 0) || !trimmedReason) {
      return NextResponse.json(
        { success: false, error: "يجب إدخال المبلغ والسبب بشكل صحيح" },
        { status: 400 }
      );
    }

    const payMethod = method === "wallet" ? "wallet" : "cash";

    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.update({
        where: { id },
        data: {
          date: date || new Date().toISOString().slice(0, 10),
          amount: expenseAmount,
          reason: trimmedReason,
          method: payMethod,
        },
      });

      // Update cash ledger
      await tx.cashLedger.deleteMany({
        where: { refType: "expense", refId: id },
      });

      await tx.cashLedger.create({
        data: {
          date: expense.date,
          type: "out",
          method: payMethod,
          amount: expenseAmount,
          source: `مصروف - ${trimmedReason}`,
          isAuto: true,
          refType: "expense",
          refId: expense.id,
        },
      });

      return expense;
    });

    return NextResponse.json({ success: true, expense: updated });
  } catch (error: any) {
    console.error("Update expense error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id } });
      if (!expense) throw new Error("المصروف غير موجود");

      const cashEntries = await tx.cashLedger.findMany({
        where: { refType: "expense", refId: id },
      });

      await tx.trashRecord.create({
        data: {
          type: "expense",
          label: `مصروف: ${expense.reason} (${expense.amount} ج.م)`,
          payload: JSON.stringify({ expense, cashEntries }),
          deletedAt: new Date().toISOString().slice(0, 10),
        },
      });

      await tx.cashLedger.deleteMany({
        where: { refType: "expense", refId: id },
      });

      await tx.expense.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "تم نقل المصروف إلى سلة المحذوفات" });
  } catch (error: any) {
    console.error("Delete expense error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete expense" },
      { status: 500 }
    );
  }
}
