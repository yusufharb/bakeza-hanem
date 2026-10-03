import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateOrderRemaining } from "@/lib/finance";

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
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      if (!order) throw new Error("الأوردر غير موجود");

      const remaining = calculateOrderRemaining(order.items as any, order.payments as any);
      if (paymentAmount > remaining + 0.001) {
        throw new Error(`مبلغ الدفعة (${paymentAmount} ج.م) أكبر من المبلغ المتبقي (${remaining} ج.م)`);
      }

      const pDate = paymentDate || new Date().toISOString().slice(0, 10);

      // Create Payment Transaction
      const payment = await tx.paymentTransaction.create({
        data: {
          amount: paymentAmount,
          method: payMethod,
          paymentDate: pDate,
          orderId: id,
        },
      });

      // Create CashLedger Entry
      await tx.cashLedger.create({
        data: {
          date: pDate,
          type: "in",
          method: payMethod,
          amount: paymentAmount,
          source: `دفعة أوردر - ${order.customerName}`,
          isAuto: true,
          refType: "order",
          refId: id,
        },
      });

      // Update Order payStatus
      const newRemaining = remaining - paymentAmount;
      const newStatus = newRemaining <= 0.001 ? "full" : "partial";
      await tx.order.update({
        where: { id },
        data: {
          payStatus: newStatus,
          method: payMethod,
        },
      });

      return payment;
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: any) {
    console.error("Order payment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
