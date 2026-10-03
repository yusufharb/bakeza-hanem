import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, amount, date, note, paidAmount } = body;

    const trimmedName = (name || "").trim();
    const payAmount = Number(amount);
    const paid = Number(paidAmount || 0);

    if (!trimmedName || !(payAmount > 0)) {
      return NextResponse.json(
        { success: false, error: "يجب كتابة الجهة والمبلغ بشكل صحيح" },
        { status: 400 }
      );
    }

    const pDate = date || new Date().toISOString().slice(0, 10);

    const result = await prisma.$transaction(async (tx) => {
      const payable = await tx.manualPayable.create({
        data: {
          name: trimmedName,
          amount: payAmount,
          date: pDate,
          note: note ? note.trim() : null,
        },
      });

      if (paid > 0) {
        await tx.paymentTransaction.create({
          data: {
            amount: paid,
            method: "cash",
            paymentDate: pDate,
            manualPayId: payable.id,
          },
        });

        await tx.cashLedger.create({
          data: {
            date: pDate,
            type: "out",
            method: "cash",
            amount: paid,
            source: `سداد يدوي - ${trimmedName}`,
            isAuto: true,
            refType: "manualPayable",
            refId: payable.id,
          },
        });
      }

      return payable;
    });

    return NextResponse.json({ success: true, payable: result });
  } catch (error: any) {
    console.error("Create manual payable error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create payable" },
      { status: 500 }
    );
  }
}
