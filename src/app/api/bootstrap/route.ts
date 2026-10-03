import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateTreasuryBalance,
  calculateOrderRemaining,
  calculatePurchaseRemaining,
  calculateTotalCapital,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      products,
      purchases,
      orders,
      expenses,
      cashEntries,
      manualReceivables,
      manualPayables,
      customers,
      trash,
      settings,
    ] = await Promise.all([
      prisma.product.findMany({
        orderBy: { code: "asc" },
        include: {
          purchases: true,
          orderItems: {
            where: { source: "stock" },
          },
        },
      }),
      prisma.purchase.findMany({
        orderBy: { purchaseDate: "desc" },
        include: {
          product: true,
          payments: true,
        },
      }),
      prisma.order.findMany({
        orderBy: { orderDate: "desc" },
        include: {
          items: true,
          payments: true,
        },
      }),
      prisma.expense.findMany({
        orderBy: { date: "desc" },
      }),
      prisma.cashLedger.findMany({
        orderBy: { date: "desc" },
      }),
      prisma.manualReceivable.findMany({
        orderBy: { date: "desc" },
        include: { payments: true },
      }),
      prisma.manualPayable.findMany({
        orderBy: { date: "desc" },
        include: { payments: true },
      }),
      prisma.customer.findMany({
        orderBy: { code: "asc" },
      }),
      prisma.trashRecord.findMany({
        orderBy: { deletedAt: "desc" },
      }),
      prisma.setting.findMany(),
    ]);

    // Calculate dynamic product stock: sum(purchases) - sum(orders from stock)
    const productsWithStock = products.map((p) => {
      const totalPurchased = p.purchases.reduce((sum, pu) => sum + pu.qty, 0);
      const totalSoldFromStock = p.orderItems.reduce((sum, it) => sum + it.qty, 0);
      const currentStock = totalPurchased - totalSoldFromStock;
      return {
        ...p,
        stock: currentStock,
        avgCost: p.currentAvgCost || 0,
      };
    });

    // Compute Treasury Balances
    const cashBalance = calculateTreasuryBalance(cashEntries as any, "cash");
    const walletBalance = calculateTreasuryBalance(cashEntries as any, "wallet");
    const totalBalance = cashBalance + walletBalance;

    // Compute Receivables (unpaid orders + unpaid manual receivables)
    const orderReceivables = orders.reduce(
      (sum, o) => sum + calculateOrderRemaining(o.items as any, o.payments as any),
      0
    );
    const manualRecTotal = manualReceivables.reduce((sum, mr) => {
      const paid = mr.payments.reduce((s, p) => s + p.amount, 0);
      return sum + Math.max(0, mr.amount - paid);
    }, 0);
    const totalReceivables = orderReceivables + manualRecTotal;

    // Compute Payables (unpaid purchases + unpaid manual payables)
    const purchasePayables = purchases.reduce(
      (sum, pu) => sum + calculatePurchaseRemaining(pu.unitCost, pu.qty, pu.payments as any),
      0
    );
    const manualPayTotal = manualPayables.reduce((sum, mp) => {
      const paid = mp.payments.reduce((s, p) => s + p.amount, 0);
      return sum + Math.max(0, mp.amount - paid);
    }, 0);
    const totalPayables = purchasePayables + manualPayTotal;

    // Stock Valuation at Cost
    const stockValuation = productsWithStock.reduce(
      (sum, p) => sum + (p.stock > 0 ? p.stock * p.avgCost : 0),
      0
    );

    // Total Operating Capital
    const capital = calculateTotalCapital(
      cashBalance,
      walletBalance,
      totalReceivables,
      stockValuation,
      totalPayables
    );

    // Total Expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        products: productsWithStock,
        purchases,
        orders,
        expenses,
        cashEntries,
        manualReceivables,
        manualPayables,
        customers,
        trash,
        settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
        kpis: {
          cashBalance,
          walletBalance,
          totalBalance,
          stockValuation,
          totalReceivables,
          totalPayables,
          totalExpenses,
          capital,
        },
      },
    });
  } catch (error: any) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load state" },
      { status: 500 }
    );
  }
}
