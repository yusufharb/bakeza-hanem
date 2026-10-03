import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, method, amount, date, source } = body;

    const cashAmount = Number(amount);
    if (!(cashAmount > 0)) {
      return NextResponse.json({ success: false, error: "المبلغ غير صحيح" }, { status: 400 });
    }

    const entryType = type === "out" ? "out" : "in";
    const payMethod = method === "wallet" ? "wallet" : "cash";
    const entryDate = date || new Date().toISOString().slice(0, 10);
    const desc = (source || "").trim() || (entryType === "in" ? "وارد يدوي" : "صادر يدوي");

    const entry = await prisma.cashLedger.create({
      data: {
        date: entryDate,
        type: entryType,
        method: payMethod,
        amount: cashAmount,
        source: desc,
        isAuto: false, // Manual entry
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error("Create cash entry error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create cash entry" },
      { status: 500 }
    );
  }
}
