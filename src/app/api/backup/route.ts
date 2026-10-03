import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Support both direct new format and original HTML backup format (state)
    const products = data.products || [];
    const purchases = data.purchases || [];
    const orders = data.orders || [];
    const expenses = data.expenses || [];
    const cash = data.cash || [];
    const manualReceivables = data.manualReceivables || [];
    const manualPayables = data.manualPayables || [];
    const customers = data.customers || [];
    const trash = data.trash || [];

    await prisma.$transaction(async (tx) => {
      // 1. Wipe current data
      await tx.trashRecord.deleteMany();
      await tx.cashLedger.deleteMany();
      await tx.paymentTransaction.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.order.deleteMany();
      await tx.purchase.deleteMany();
      await tx.product.deleteMany();
      await tx.manualReceivable.deleteMany();
      await tx.manualPayable.deleteMany();
      await tx.customer.deleteMany();
      await tx.expense.deleteMany();

      // 2. Import Customers
      for (const c of customers) {
        await tx.customer.create({
          data: {
            id: c.id,
            code: c.code,
            name: c.name,
            phone: c.phone || null,
          },
        });
      }

      // 3. Import Products
      for (const p of products) {
        await tx.product.create({
          data: {
            id: p.id,
            code: p.code,
            name: p.name,
            sellingPrice: Number(p.price || p.sellingPrice || 0),
            minStock: Number(p.minStock || 0),
            currentAvgCost: Number(p.currentAvgCost || 0),
            isActive: p.isActive !== undefined ? Boolean(p.isActive) : true,
          },
        });
      }

      // 4. Import Purchases & payments
      for (const pu of purchases) {
        await tx.purchase.create({
          data: {
            id: pu.id,
            productId: pu.productId,
            supplier: pu.supplier || "-",
            purchaseDate: pu.date || pu.purchaseDate || new Date().toISOString().slice(0, 10),
            unitCost: Number(pu.unitCost || 0),
            qty: Number(pu.qty || 1),
            totalCost: Number(pu.unitCost || 0) * Number(pu.qty || 1),
            payMethod: pu.payMethod || "cash",
            payments: {
              create: (pu.payments || []).map((p: any) => ({
                amount: Number(p.amount || 0),
                method: p.method || "cash",
                paymentDate: p.date || p.paymentDate || pu.date || new Date().toISOString().slice(0, 10),
              })),
            },
          },
        });
      }

      // 5. Import Orders & items & payments
      for (const o of orders) {
        await tx.order.create({
          data: {
            id: o.id,
            customerName: o.customer || o.customerName || "-",
            customerPhone: o.phone || o.customerPhone || null,
            orderDate: o.date || o.orderDate || new Date().toISOString().slice(0, 10),
            payStatus: o.payStatus || "none",
            method: o.method || null,
            purchMethod: o.purchMethod || "cash",
            isDelivered: Boolean(o.delivered || o.isDelivered),
            notes: o.note || o.notes || null,
            items: {
              create: (o.items || []).map((it: any) => ({
                productId: it.productId || null,
                productName: it.productName || "-",
                qty: Number(it.qty || 1),
                sellPrice: Number(it.sellPrice || 0),
                source: it.source || "stock",
                shopName: it.shopName || null,
                costPrice: Number(it.costPrice || 0),
              })),
            },
            payments: {
              create: (o.payments || []).map((p: any) => ({
                amount: Number(p.amount || 0),
                method: p.method || "cash",
                paymentDate: p.date || p.paymentDate || o.date || new Date().toISOString().slice(0, 10),
              })),
            },
          },
        });
      }

      // 6. Import Expenses
      for (const e of expenses) {
        await tx.expense.create({
          data: {
            id: e.id,
            date: e.date,
            amount: Number(e.amount || 0),
            reason: e.reason || "-",
            method: e.method || "cash",
          },
        });
      }

      // 7. Import Cash Entries
      for (const c of cash) {
        await tx.cashLedger.create({
          data: {
            id: c.id,
            date: c.date,
            type: c.type || "in",
            method: c.method || "cash",
            amount: Number(c.amount || 0),
            source: c.source || "-",
            isAuto: Boolean(c.auto || c.isAuto),
            refType: c.refType || null,
            refId: c.refId || null,
          },
        });
      }

      // 8. Import Manual Receivables
      for (const r of manualReceivables) {
        await tx.manualReceivable.create({
          data: {
            id: r.id,
            name: r.name,
            amount: Number(r.amount || 0),
            date: r.date,
            note: r.note || null,
            payments: {
              create: (r.payments || []).map((p: any) => ({
                amount: Number(p.amount || 0),
                method: p.method || "cash",
                paymentDate: p.date || p.paymentDate || r.date,
              })),
            },
          },
        });
      }

      // 9. Import Manual Payables
      for (const p of manualPayables) {
        await tx.manualPayable.create({
          data: {
            id: p.id,
            name: p.name,
            amount: Number(p.amount || 0),
            date: p.date,
            note: p.note || null,
            payments: {
              create: (p.payments || []).map((pm: any) => ({
                amount: Number(pm.amount || 0),
                method: pm.method || "cash",
                paymentDate: pm.date || pm.paymentDate || p.date,
              })),
            },
          },
        });
      }

      // 10. Import Trash
      for (const t of trash) {
        await tx.trashRecord.create({
          data: {
            id: t.id,
            type: t.type,
            label: t.label,
            payload: typeof t.payload === "string" ? t.payload : JSON.stringify(t.payload),
            deletedAt: t.deletedAt || new Date().toISOString().slice(0, 10),
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "تم استيراد البيانات بنجاح" });
  } catch (error: any) {
    console.error("Import backup error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to import backup" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.trashRecord.deleteMany();
      await tx.cashLedger.deleteMany();
      await tx.paymentTransaction.deleteMany();
      await tx.orderItem.deleteMany();
      await tx.order.deleteMany();
      await tx.purchase.deleteMany();
      await tx.product.deleteMany();
      await tx.manualReceivable.deleteMany();
      await tx.manualPayable.deleteMany();
      await tx.customer.deleteMany();
      await tx.expense.deleteMany();
      await tx.setting.deleteMany();
    });

    return NextResponse.json({ success: true, message: "تم مسح كافة البيانات بنجاح" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset data" },
      { status: 500 }
    );
  }
}
