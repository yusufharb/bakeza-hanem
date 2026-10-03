import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "الأوردر غير موجود" }, { status: 404 });
    }

    const nextDelivered = !order.isDelivered;
    const updated = await prisma.order.update({
      where: { id },
      data: {
        isDelivered: nextDelivered,
        deliveredAt: nextDelivered ? new Date() : null,
      },
      include: { items: true, payments: true },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    console.error("Toggle delivered error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update delivery status" },
      { status: 500 }
    );
  }
}
