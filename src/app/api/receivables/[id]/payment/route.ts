import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { amount, method, paymentDate } = body;

    const paymentAmount = Number(amount);
    if (!(paymentAmount > 0)) {
      return NextResponse.json({ success: false, error: "قيمة الدفعة غير صحيحة" }, { status: 400 });
    }
    const payMethod = method === "wallet" ? "wallet" : "cash";

    const result = await prisma.$transaction(async (tx) => {
      const rec = await tx.manualReceivable.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!rec) throw new Error("السند غير موجود");

      const paidTotal = rec.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, rec.amount - paidTotal);

      if (paymentAmount > remaining + 0.001) {
        throw new Error(
          `مبلغ الدفعة (${paymentAmount} ج.م) أكبر من المبلغ المتبقي (${remaining} ج.م)`
        );
      }

      const pDate = paymentDate || new Date().toISOString().slice(0, 10);

      const payment = await tx.paymentTransaction.create({
        data: {
          amount: paymentAmount,
          method: payMethod,
          paymentDate: pDate,
          manualRecId: id,
        },
      });

      await tx.cashLedger.create({
        data: {
          date: pDate,
          type: "in",
          method: payMethod,
          amount: paymentAmount,
          source: `تحصيل يدوي - ${rec.name}`,
          isAuto: true,
          refType: "manualReceivable",
          refId: id,
        },
      });

      return payment;
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: any) {
    console.error("Manual receivable payment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
