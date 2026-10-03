import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateNewMovingAverageCost,
  calculatePurchaseTotal,
} from "@/lib/finance";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      supplier,
      purchaseDate,
      unitCost,
      qty,
      sellingPrice,
      payMethod,
      minStock,
    } = body;

    const trimmedName = (name || "").trim();
    const cost = Number(unitCost);
    const quantity = Number(qty);
    const price = Number(sellingPrice);

    if (!trimmedName) {
      return NextResponse.json({ success: false, error: "اسم الصنف مطلوب" }, { status: 400 });
    }
    if (!(cost >= 0) || !(quantity > 0)) {
      return NextResponse.json(
        { success: false, error: "يجب إدخال تكلفة وكمية صحيحة" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create Product
      let product = await tx.product.findFirst({
        where: { name: trimmedName },
        include: {
          purchases: true,
          orderItems: { where: { source: "stock" } },
        },
      });

      let currentStock = 0;
      let currentAvgCost = 0;

      if (!product) {
        const count = await tx.product.count();
        const code = `BH-${String(count + 1).padStart(3, "0")}`;
        product = await tx.product.create({
          data: {
            code,
            name: trimmedName,
            sellingPrice: price >= 0 ? price : cost * 1.25,
            minStock: Number(minStock) || 0,
            currentAvgCost: cost,
            isActive: true,
          },
          include: {
            purchases: true,
            orderItems: true,
          },
        });
        currentStock = 0;
        currentAvgCost = cost;
      } else {
        const totalPurchased = product.purchases.reduce((sum, pu) => sum + pu.qty, 0);
        const totalSold = product.orderItems.reduce((sum, it) => sum + it.qty, 0);
        currentStock = totalPurchased - totalSold;
        currentAvgCost = product.currentAvgCost || cost;

        // Apply Moving Weighted Average (MWA) for new purchase
        const newMovingAvg = calculateNewMovingAverageCost(
          currentStock,
          currentAvgCost,
          quantity,
          cost
        );

        product = await tx.product.update({
          where: { id: product.id },
          data: {
            sellingPrice: price >= 0 ? price : product.sellingPrice,
            minStock: minStock !== undefined ? Number(minStock) : product.minStock,
            currentAvgCost: newMovingAvg,
            isActive: true,
          },
          include: {
            purchases: true,
            orderItems: true,
          },
        });
      }

      // 2. Insert Purchase record
      const totalCost = calculatePurchaseTotal(cost, quantity);
      const pDate = purchaseDate || new Date().toISOString().slice(0, 10);
      const supplierName = (supplier || "").trim() || "-";

      const purchase = await tx.purchase.create({
        data: {
          productId: product.id,
          supplier: supplierName,
          purchaseDate: pDate,
          unitCost: cost,
          qty: quantity,
          totalCost,
          payMethod: payMethod || "cash",
        },
        include: {
          product: true,
          payments: true,
        },
      });

      // 3. Handle immediate payment (cash or wallet)
      if (payMethod === "cash" || payMethod === "wallet") {
        await tx.paymentTransaction.create({
          data: {
            amount: totalCost,
            method: payMethod,
            paymentDate: pDate,
            purchaseId: purchase.id,
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
            refId: purchase.id,
          },
        });
      }

      return purchase;
    });

    return NextResponse.json({ success: true, purchase: result });
  } catch (error: any) {
    console.error("Create purchase error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record purchase" },
      { status: 500 }
    );
  }
}
