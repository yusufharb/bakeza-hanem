const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding default settings...");
  await prisma.setting.upsert({
    where: { key: "waNumber" },
    update: {},
    create: { key: "waNumber", value: "201124012072" },
  });

  await prisma.setting.upsert({
    where: { key: "shopName" },
    update: {},
    create: { key: "shopName", value: "بكيزة هانم" },
  });

  await prisma.setting.upsert({
    where: { key: "lastBackup" },
    update: {},
    create: { key: "lastBackup", value: new Date().toISOString().slice(0, 10) },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
