import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const list = await prisma.trashRecord.findMany({
      orderBy: { deletedAt: "desc" },
    });
    return NextResponse.json({ success: true, trash: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    const trash = await prisma.trashRecord.findUnique({ where: { id } });
    if (!trash) {
      return NextResponse.json({ success: false, error: "العنصر غير موجود بالسلة" }, { status: 404 });
    }

    const payload = JSON.parse(trash.payload);

    await prisma.$transaction(async (tx) => {
      if (trash.type === "order") {
        const { order, cashEntries } = payload;
        // Re-create order
        await tx.order.create({
          data: {
            id: order.id,
            customerId: order.customerId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            orderDate: order.orderDate,
            payStatus: order.payStatus,
            method: order.method,
            purchMethod: order.purchMethod,
            isDelivered: order.isDelivered,
            deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : null,
            notes: order.notes,
            items: {
              create: order.items.map((it: any) => ({
                id: it.id,
                productId: it.productId,
                productName: it.productName,
                qty: it.qty,
                sellPrice: it.sellPrice,
                source: it.source,
                shopName: it.shopName,
                costPrice: it.costPrice,
              })),
            },
            payments: {
              create: order.payments.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                method: p.method,
                paymentDate: p.paymentDate,
              })),
            },
          },
        });

        // Re-insert cash entries
        if (cashEntries && cashEntries.length > 0) {
          for (const c of cashEntries) {
            await tx.cashLedger.create({
              data: {
                id: c.id,
                date: c.date,
                type: c.type,
                method: c.method,
                amount: c.amount,
                source: c.source,
                isAuto: c.isAuto,
                refType: c.refType,
                refId: c.refId,
              },
            });
          }
        }
      } else if (trash.type === "purchase") {
        const { purchase, cashEntries } = payload;
        await tx.purchase.create({
          data: {
            id: purchase.id,
            productId: purchase.productId,
            supplier: purchase.supplier,
            purchaseDate: purchase.purchaseDate,
            unitCost: purchase.unitCost,
            qty: purchase.qty,
            totalCost: purchase.totalCost,
            payMethod: purchase.payMethod,
            payments: {
              create: purchase.payments.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                method: p.method,
                paymentDate: p.paymentDate,
              })),
            },
          },
        });

        if (cashEntries && cashEntries.length > 0) {
          for (const c of cashEntries) {
            await tx.cashLedger.create({
              data: {
                id: c.id,
                date: c.date,
                type: c.type,
                method: c.method,
                amount: c.amount,
                source: c.source,
                isAuto: c.isAuto,
                refType: c.refType,
                refId: c.refId,
              },
            });
          }
        }
      } else if (trash.type === "product") {
        const { product } = payload;
        await tx.product.create({
          data: {
            id: product.id,
            code: product.code,
            name: product.name,
            sellingPrice: product.sellingPrice,
            minStock: product.minStock,
            currentAvgCost: product.currentAvgCost,
            isActive: true,
          },
        });
      } else if (trash.type === "expense") {
        const { expense, cashEntries } = payload;
        await tx.expense.create({
          data: {
            id: expense.id,
            date: expense.date,
            amount: expense.amount,
            reason: expense.reason,
            method: expense.method,
          },
        });
        if (cashEntries && cashEntries.length > 0) {
          for (const c of cashEntries) {
            await tx.cashLedger.create({
              data: {
                id: c.id,
                date: c.date,
                type: c.type,
                method: c.method,
                amount: c.amount,
                source: c.source,
                isAuto: c.isAuto,
                refType: c.refType,
                refId: c.refId,
              },
            });
          }
        }
      } else if (trash.type === "manualReceivable") {
        const { item, cashEntries } = payload;
        await tx.manualReceivable.create({
          data: {
            id: item.id,
            customerId: item.customerId,
            name: item.name,
            amount: item.amount,
            date: item.date,
            note: item.note,
            payments: {
              create: item.payments.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                method: p.method,
                paymentDate: p.paymentDate,
              })),
            },
          },
        });
        if (cashEntries && cashEntries.length > 0) {
          for (const c of cashEntries) {
            await tx.cashLedger.create({
              data: {
                id: c.id,
                date: c.date,
                type: c.type,
                method: c.method,
                amount: c.amount,
                source: c.source,
                isAuto: c.isAuto,
                refType: c.refType,
                refId: c.refId,
              },
            });
          }
        }
      } else if (trash.type === "manualPayable") {
        const { item, cashEntries } = payload;
        await tx.manualPayable.create({
          data: {
            id: item.id,
            name: item.name,
            amount: item.amount,
            date: item.date,
            note: item.note,
            payments: {
              create: item.payments.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                method: p.method,
                paymentDate: p.paymentDate,
              })),
            },
          },
        });
        if (cashEntries && cashEntries.length > 0) {
          for (const c of cashEntries) {
            await tx.cashLedger.create({
              data: {
                id: c.id,
                date: c.date,
                type: c.type,
                method: c.method,
                amount: c.amount,
                source: c.source,
                isAuto: c.isAuto,
                refType: c.refType,
                refId: c.refId,
              },
            });
          }
        }
      } else if (trash.type === "cash") {
        const { cash } = payload;
        await tx.cashLedger.create({
          data: {
            id: cash.id,
            date: cash.date,
            type: cash.type,
            method: cash.method,
            amount: cash.amount,
            source: cash.source,
            isAuto: false,
          },
        });
      }

      await tx.trashRecord.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "تم استرجاع العنصر بنجاح" });
  } catch (error: any) {
    console.error("Restore trash error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to restore item" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.trashRecord.deleteMany();
    return NextResponse.json({ success: true, message: "تم إفراغ سلة المحذوفات نهائياً" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to empty trash" },
      { status: 500 }
    );
  }
}
