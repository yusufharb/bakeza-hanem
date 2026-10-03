import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, sellingPrice, minStock, isActive } = body;

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return NextResponse.json({ success: false, error: "اسم الصنف مطلوب" }, { status: 400 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: trimmedName,
        sellingPrice: Number(sellingPrice) >= 0 ? Number(sellingPrice) : 0,
        minStock: Number(minStock) >= 0 ? Number(minStock) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        purchases: true,
        orderItems: true,
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });
    }

    // FROZEN ARCHIVAL RULE:
    // If the product has historical purchases or sales, ARCHIVE it safely (do NOT destroy cash/accounting history!)
    if (product.purchases.length > 0 || product.orderItems.length > 0) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: "تم أرشفة الصنف وإيقافه بنجاح للحفاظ على التاريخ المالي والمبيعات السابقة",
        archived: true,
      });
    }

    // If completely new with 0 activity, allow deletion to trash
    await prisma.trashRecord.create({
      data: {
        type: "product",
        label: `منتج: ${product.name}`,
        payload: JSON.stringify({ product }),
        deletedAt: new Date().toISOString().slice(0, 10),
      },
    });

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "تم نقل الصنف إلى سلة المحذوفات",
      archived: false,
    });
  } catch (error: any) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process product deletion" },
      { status: 500 }
    );
  }
}
