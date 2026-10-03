import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateOrderTotal,
  calculateOrderSupplierCost,
} from "@/lib/finance";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      orderDate,
      payStatus,
      method,
      purchMethod,
      isDelivered,
      notes,
      items,
      paidAmount,
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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get or create Customer
      let customer = await tx.customer.findFirst({
        where: { name: trimmedCustomer },
      });

      if (!customer) {
        const count = await tx.customer.count();
        const code = `CU-${String(count + 1).padStart(3, "0")}`;
        customer = await tx.customer.create({
          data: {
            code,
            name: trimmedCustomer,
            phone: customerPhone ? customerPhone.trim() : null,
          },
        });
      } else if (customerPhone && !customer.phone) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { phone: customerPhone.trim() },
        });
      }

      // 2. Fetch existing products to freeze accurate cost prices for stock items
      const productIds = items
        .filter((it: any) => it.source === "stock" && it.productId)
        .map((it: any) => it.productId);
      const stockProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(stockProducts.map((p) => [p.id, p]));

      // 3. Prepare items with FROZEN costPrice
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

      // 4. Calculate total & initial payment
      const orderTotal = calculateOrderTotal(preparedItems as any);
      let initialPaid = 0;
      let effectiveMethod = method;

      if (payStatus === "full") {
        initialPaid = orderTotal;
      } else if (payStatus === "partial") {
        initialPaid = Math.max(0, Math.min(orderTotal, Number(paidAmount) || 0));
      } else {
        initialPaid = 0;
        effectiveMethod = null;
      }

      // 5. Create Order
      const newOrder = await tx.order.create({
        data: {
          customerId: customer.id,
          customerName: trimmedCustomer,
          customerPhone: customerPhone ? customerPhone.trim() : null,
          orderDate: orderDate || new Date().toISOString().slice(0, 10),
          payStatus: payStatus || "none",
          method: effectiveMethod,
          purchMethod: purchMethod || "cash",
          isDelivered: Boolean(isDelivered),
          deliveredAt: isDelivered ? new Date() : null,
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

      // 6. Record payment if paid > 0
      if (initialPaid > 0 && effectiveMethod) {
        await tx.paymentTransaction.create({
          data: {
            amount: initialPaid,
            method: effectiveMethod,
            paymentDate: newOrder.orderDate,
            orderId: newOrder.id,
          },
        });

        await tx.cashLedger.create({
          data: {
            date: newOrder.orderDate,
            type: "in",
            method: effectiveMethod,
            amount: initialPaid,
            source: `دفعة أوردر - ${trimmedCustomer}`,
            isAuto: true,
            refType: "order",
            refId: newOrder.id,
          },
        });
      }

      // 7. Sourcing Payment: Deduct supplier purchase cost for on-demand items
      const supplierCost = calculateOrderSupplierCost(preparedItems as any);
      if (supplierCost > 0) {
        const sourceMethod = purchMethod === "wallet" ? "wallet" : "cash";
        await tx.cashLedger.create({
          data: {
            date: newOrder.orderDate,
            type: "out",
            method: sourceMethod,
            amount: supplierCost,
            source: `شراء أوردر - ${trimmedCustomer}`,
            isAuto: true,
            refType: "order",
            refId: newOrder.id,
          },
        });
      }

      return newOrder;
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error: any) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
