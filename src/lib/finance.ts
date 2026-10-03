/**
 * Bakeza Hanem - Central Financial & Business Engine
 * Implements confirmed business rules & frozen decisions:
 * 1. Moving Weighted Average (MWA) for Inventory Costing
 * 2. Cash / Wallet immediate payment for on-demand supplier purchases
 * 3. Historical cost freezing for order line items
 * 4. Treasury balance consistency and double-entry safeguards
 */

export interface OrderItemData {
  id?: string;
  productId?: string | null;
  productName: string;
  qty: number;
  sellPrice: number;
  source: "stock" | "supplier";
  shopName?: string | null;
  costPrice: number; // Frozen cost at transaction time
}

export interface PaymentData {
  id?: string;
  amount: number;
  method: "cash" | "wallet";
  paymentDate: string;
}

export interface OrderData {
  id?: string;
  customerName: string;
  customerPhone?: string | null;
  orderDate: string;
  payStatus?: "full" | "partial" | "none";
  method?: "cash" | "wallet" | null;
  purchMethod?: "cash" | "wallet" | null;
  isDelivered?: boolean;
  notes?: string | null;
  items: OrderItemData[];
  payments: PaymentData[];
}

export interface PurchaseData {
  id?: string;
  productId: string;
  supplier: string;
  purchaseDate: string;
  unitCost: number;
  qty: number;
  totalCost: number;
  payMethod: "cash" | "wallet" | "deferred";
  payments: PaymentData[];
}

export interface CashEntryData {
  id?: string;
  date: string;
  type: "in" | "out";
  method: "cash" | "wallet";
  amount: number;
  source: string;
  isAuto: boolean;
  refType?: string | null;
  refId?: string | null;
}

/**
 * Calculate Moving Weighted Average (MWA) Unit Cost upon new purchase
 * If current stock <= 0, new cost is simply the new purchase unit cost.
 * Otherwise: (currentStock * currentAvgCost + newQty * newUnitCost) / (currentStock + newQty)
 */
export function calculateNewMovingAverageCost(
  currentStock: number,
  currentAvgCost: number,
  newQty: number,
  newUnitCost: number
): number {
  if (newQty <= 0) return currentAvgCost;
  if (currentStock <= 0) return Number(newUnitCost);
  const totalCost = currentStock * currentAvgCost + newQty * newUnitCost;
  const totalQty = currentStock + newQty;
  return totalQty > 0 ? totalCost / totalQty : Number(newUnitCost);
}

/**
 * Calculate order selling total
 */
export function calculateOrderTotal(items: OrderItemData[]): number {
  return items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.sellPrice || 0), 0);
}

/**
 * Calculate order cost total (using frozen costPrice of items)
 */
export function calculateOrderCostTotal(items: OrderItemData[]): number {
  return items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.costPrice || 0), 0);
}

/**
 * Calculate order gross margin
 */
export function calculateOrderMargin(items: OrderItemData[]): number {
  return calculateOrderTotal(items) - calculateOrderCostTotal(items);
}

/**
 * Calculate supplier purchase cost for on-demand items (to deduct from cash/wallet)
 */
export function calculateOrderSupplierCost(items: OrderItemData[]): number {
  return items.reduce(
    (sum, item) =>
      item.source === "supplier" ? sum + Number(item.qty || 0) * Number(item.costPrice || 0) : sum,
    0
  );
}

/**
 * Calculate total paid for an order
 */
export function calculateOrderPaid(payments: PaymentData[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Calculate remaining unpaid balance for an order
 */
export function calculateOrderRemaining(items: OrderItemData[], payments: PaymentData[]): number {
  const total = calculateOrderTotal(items);
  const paid = calculateOrderPaid(payments);
  return Math.max(0, total - paid);
}

/**
 * Calculate purchase total
 */
export function calculatePurchaseTotal(unitCost: number, qty: number): number {
  return Number(unitCost || 0) * Number(qty || 0);
}

/**
 * Calculate total paid for a purchase
 */
export function calculatePurchasePaid(payments: PaymentData[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Calculate remaining unpaid balance for a purchase (payable)
 */
export function calculatePurchaseRemaining(unitCost: number, qty: number, payments: PaymentData[]): number {
  const total = calculatePurchaseTotal(unitCost, qty);
  const paid = calculatePurchasePaid(payments);
  return Math.max(0, total - paid);
}

/**
 * Calculate treasury balance for cash or wallet
 */
export function calculateTreasuryBalance(entries: CashEntryData[], method: "cash" | "wallet"): number {
  return entries
    .filter((e) => e.method === method)
    .reduce((sum, e) => sum + (e.type === "in" ? Number(e.amount || 0) : -Number(e.amount || 0)), 0);
}

/**
 * Calculate total operating capital formula:
 * Capital = Cash + Wallet + Receivables + StockValuation - Payables
 */
export function calculateTotalCapital(
  cashBalance: number,
  walletBalance: number,
  receivables: number,
  stockValuation: number,
  payables: number
): number {
  return cashBalance + walletBalance + receivables + stockValuation - payables;
}

/**
 * Day Closing calculation formula
 */
export function calculateDayClosing(
  todayOrders: { items: OrderItemData[] }[],
  todayPurchases: { unitCost: number; qty: number }[],
  todayExpenses: { amount: number }[]
) {
  const totalSell = todayOrders.reduce((sum, o) => sum + calculateOrderTotal(o.items), 0);
  const totalCost = todayOrders.reduce((sum, o) => sum + calculateOrderCostTotal(o.items), 0);
  const grossMargin = totalSell - totalCost;
  const newStockPurchases = todayPurchases.reduce(
    (sum, p) => sum + calculatePurchaseTotal(p.unitCost, p.qty),
    0
  );
  const totalExpenses = todayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = grossMargin - totalExpenses;

  return {
    orderCount: todayOrders.length,
    totalSell,
    totalCost,
    grossMargin,
    newStockPurchases,
    totalExpenses,
    netProfit,
  };
}

/**
 * Validate order data completeness (as in HTML orderMissing)
 */
export function checkOrderMissingFields(order: OrderData): string[] {
  const missing: string[] = [];
  if (!order.customerName?.trim()) missing.push("اسم العميل");
  if (!order.orderDate?.trim()) missing.push("التاريخ");
  if (!order.items || order.items.length === 0) missing.push("الأصناف");

  order.items.forEach((item, index) => {
    const idx = index + 1;
    if (!item.productName?.trim()) missing.push(`منتج صنف ${idx}`);
    if (!(Number(item.qty) > 0)) missing.push(`كمية صنف ${idx}`);
    if (item.sellPrice === undefined || item.sellPrice === null || Number(item.sellPrice) < 0) {
      missing.push(`سعر بيع صنف ${idx}`);
    }
    if (item.source === "supplier" && !item.shopName?.trim()) {
      missing.push(`اسم محل صنف ${idx}`);
    }
  });

  const remaining = calculateOrderRemaining(order.items, order.payments);
  const total = calculateOrderTotal(order.items);
  if (remaining < total && remaining > 0 && !order.method) {
    missing.push("طريقة الدفع");
  }

  return missing;
}
