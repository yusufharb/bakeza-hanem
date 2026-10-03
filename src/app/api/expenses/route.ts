import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
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
    const expDate = date || new Date().toISOString().slice(0, 10);

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          date: expDate,
          amount: expenseAmount,
          reason: trimmedReason,
          method: payMethod,
        },
      });

      await tx.cashLedger.create({
        data: {
          date: expDate,
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

    return NextResponse.json({ success: true, expense: result });
  } catch (error: any) {
    console.error("Create expense error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record expense" },
      { status: 500 }
    );
  }
}
