import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePurchaseTotal } from "@/lib/finance";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { supplier, purchaseDate, unitCost, qty, payMethod } = body;

    const cost = Number(unitCost);
    const quantity = Number(qty);
    if (!(cost >= 0) || !(quantity > 0)) {
      return NextResponse.json({ success: false, error: "بيانات الشراء غير صحيحة" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { id },
        include: { product: true, payments: true },
      });
      if (!existing) throw new Error("عملية الشراء غير موجودة");

      const totalCost = calculatePurchaseTotal(cost, quantity);
      const pDate = purchaseDate || existing.purchaseDate;
      const supplierName = (supplier || "").trim() || existing.supplier;

      // Update purchase record
      const pu = await tx.purchase.update({
        where: { id },
        data: {
          supplier: supplierName,
          purchaseDate: pDate,
          unitCost: cost,
          qty: quantity,
          totalCost,
          payMethod: payMethod || existing.payMethod,
        },
        include: { product: true, payments: true },
      });

      // If method changed or amounts changed, update cash ledger
      await tx.cashLedger.deleteMany({
        where: { refType: "purchase", refId: id },
      });
      await tx.paymentTransaction.deleteMany({
        where: { purchaseId: id },
      });

      if (payMethod === "cash" || payMethod === "wallet") {
        await tx.paymentTransaction.create({
          data: {
            amount: totalCost,
            method: payMethod,
            paymentDate: pDate,
            purchaseId: id,
          },
        });

        await tx.cashLedger.create({
          data: {
            date: pDate,
            type: "out",
            method: payMethod,
            amount: totalCost,
            source: `شراء - ${supplierName}`,
            isAuto: true,
            refType: "purchase",
            refId: id,
          },
        });
      }

      return pu;
    });

    return NextResponse.json({ success: true, purchase: updated });
  } catch (error: any) {
    console.error("Edit purchase error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update purchase" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: { product: true, payments: true },
      });
      if (!purchase) throw new Error("عملية الشراء غير موجودة");

      const cashEntries = await tx.cashLedger.findMany({
        where: { refType: "purchase", refId: id },
      });

      // Save to trash snapshot
      await tx.trashRecord.create({
        data: {
          type: "purchase",
          label: `شراء: ${purchase.product.name} من ${purchase.supplier}`,
          payload: JSON.stringify({ purchase, cashEntries }),
          deletedAt: new Date().toISOString().slice(0, 10),
        },
      });

      // Remove cash ledger entries
      await tx.cashLedger.deleteMany({
        where: { refType: "purchase", refId: id },
      });

      // Delete purchase
      await tx.purchase.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "تم نقل عملية الشراء إلى سلة المحذوفات" });
  } catch (error: any) {
    console.error("Delete purchase error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete purchase" },
      { status: 500 }
    );
  }
}
