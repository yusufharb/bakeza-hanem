import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number | string | null | undefined): string {
  const num = Number(n || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function todayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysBetween(dateStr: string): number {
  if (!dateStr) return 0;
  const d1 = new Date(dateStr + "T00:00:00");
  const d2 = new Date(todayStr() + "T00:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

const AR_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function formatArabicDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  return `${AR_WEEKDAYS[date.getDay()]}، ${date.getDate()} ${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function getMethodLabel(method: string | null | undefined): string {
  if (method === "wallet") return "محفظة";
  if (method === "cash") return "نقدي";
  if (method === "deferred") return "آجل";
  return "-";
}
