import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateOrderTotal,
  calculateOrderSupplierCost,
} from "@/lib/finance";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      orderDate,
      method,
      purchMethod,
      isDelivered,
      notes,
      items,
    } = body;

    const trimmedCustomer = (customerName || "").trim();
    if (!trimmedCustomer) {
      return NextResponse.json({ success: false, error: "اسم العميل مطلوب" }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "يجب إضافة صنف واحد على الأقل" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      if (!existing) {
        throw new Error("الأوردر غير موجود");
      }

      // Fetch products for stock items
      const productIds = items
        .filter((it: any) => it.source === "stock" && it.productId)
        .map((it: any) => it.productId);
      const stockProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(stockProducts.map((p) => [p.id, p]));

      // Prepare items
      const preparedItems = items.map((it: any) => {
        let frozenCost = Number(it.costPrice || 0);
        if (it.source === "stock" && it.productId && productMap.has(it.productId)) {
          frozenCost = productMap.get(it.productId)!.currentAvgCost || 0;
        }
        return {
          productId: it.productId || null,
          productName: (it.productName || "").trim(),
          qty: Math.max(1, Number(it.qty) || 1),
          sellPrice: Number(it.sellPrice) || 0,
          source: it.source === "stock" ? "stock" : "supplier",
          shopName: it.source === "supplier" ? (it.shopName || "").trim() : null,
          costPrice: frozenCost,
        };
      });

      // Delete old items and insert new items
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      // Update Order Header (preserving payments!)
      const order = await tx.order.update({
        where: { id },
        data: {
          customerName: trimmedCustomer,
          customerPhone: customerPhone ? customerPhone.trim() : null,
          orderDate: orderDate || existing.orderDate,
          method: method || existing.method,
          purchMethod: purchMethod || existing.purchMethod,
          isDelivered: Boolean(isDelivered),
          deliveredAt: isDelivered && !existing.isDelivered ? new Date() : existing.deliveredAt,
          notes: notes ? notes.trim() : null,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });

      // Update supplier purchase cost in cash ledger
      // 1. Remove previous supplier purchase entry for this order
      await tx.cashLedger.deleteMany({
        where: {
          refType: "order",
          refId: id,
          type: "out",
        },
      });

      // 2. Add new supplier purchase entry if applicable
      const supplierCost = calculateOrderSupplierCost(preparedItems as any);
      if (supplierCost > 0) {
        const sourceMethod = (purchMethod || order.purchMethod) === "wallet" ? "wallet" : "cash";
        await tx.cashLedger.create({
          data: {
            date: order.orderDate,
            type: "out",
            method: sourceMethod,
            amount: supplierCost,
            source: `شراء أوردر - ${trimmedCustomer}`,
            isAuto: true,
            refType: "order",
            refId: order.id,
          },
        });
      }

      return order;
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    console.error("Edit order error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      if (!order) throw new Error("الأوردر غير موجود");

      // Get linked cash entries
      const cashEntries = await tx.cashLedger.findMany({
        where: { refType: "order", refId: id },
      });

      // Save to trash snapshot
      await tx.trashRecord.create({
        data: {
          type: "order",
          label: `أوردر: ${order.customerName} (${order.orderDate})`,
          payload: JSON.stringify({ order, cashEntries }),
          deletedAt: new Date().toISOString().slice(0, 10),
        },
      });

      // Remove cash ledger entries
      await tx.cashLedger.deleteMany({
        where: { refType: "order", refId: id },
      });

      // Delete order (cascades items and payments)
      await tx.order.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: "تم نقل الأوردر إلى سلة المحذوفات" });
  } catch (error: any) {
    console.error("Delete order error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete order" },
      { status: 500 }
    );
  }
}
