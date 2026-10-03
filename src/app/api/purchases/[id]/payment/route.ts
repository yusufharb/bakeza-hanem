import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePurchaseRemaining } from "@/lib/finance";

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
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!purchase) throw new Error("عملية الشراء غير موجودة");

      const remaining = calculatePurchaseRemaining(
        purchase.unitCost,
        purchase.qty,
        purchase.payments as any
      );
      if (paymentAmount > remaining + 0.001) {
        throw new Error(
          `مبلغ الدفعة (${paymentAmount} ج.م) أكبر من المبلغ المتبقي (${remaining} ج.م)`
        );
      }

      const pDate = paymentDate || new Date().toISOString().slice(0, 10);

      // Create Payment Transaction
      const payment = await tx.paymentTransaction.create({
        data: {
          amount: paymentAmount,
          method: payMethod,
          paymentDate: pDate,
          purchaseId: id,
        },
      });

      // Create CashLedger Entry
      await tx.cashLedger.create({
        data: {
          date: pDate,
          type: "out",
          method: payMethod,
          amount: paymentAmount,
          source: `دفعة شراء - ${purchase.supplier}`,
          isAuto: true,
          refType: "purchase",
          refId: id,
        },
      });

      return payment;
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: any) {
    console.error("Purchase payment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
