import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, amount, date, note, paidAmount } = body;

    const trimmedName = (name || "").trim();
    const recAmount = Number(amount);
    const paid = Number(paidAmount || 0);

    if (!trimmedName || !(recAmount > 0)) {
      return NextResponse.json(
        { success: false, error: "يجب كتابة الاسم والمبلغ بشكل صحيح" },
        { status: 400 }
      );
    }

    const rDate = date || new Date().toISOString().slice(0, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Find or create customer
      let customer = await tx.customer.findFirst({ where: { name: trimmedName } });
      if (!customer) {
        const count = await tx.customer.count();
        customer = await tx.customer.create({
          data: {
            code: `CU-${String(count + 1).padStart(3, "0")}`,
            name: trimmedName,
          },
        });
      }

      const receivable = await tx.manualReceivable.create({
        data: {
          customerId: customer.id,
          name: trimmedName,
          amount: recAmount,
          date: rDate,
          note: note ? note.trim() : null,
        },
      });

      if (paid > 0) {
        await tx.paymentTransaction.create({
          data: {
            amount: paid,
            method: "cash",
            paymentDate: rDate,
            manualRecId: receivable.id,
          },
        });

        await tx.cashLedger.create({
          data: {
            date: rDate,
            type: "in",
            method: "cash",
            amount: paid,
            source: `تحصيل يدوي - ${trimmedName}`,
            isAuto: true,
            refType: "manualReceivable",
            refId: receivable.id,
          },
        });
      }

      return receivable;
    });

    return NextResponse.json({ success: true, receivable: result });
  } catch (error: any) {
    console.error("Create manual receivable error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create receivable" },
      { status: 500 }
    );
  }
}
