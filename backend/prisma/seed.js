"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.admin.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: hashedPassword,
            role: 'admin',
        },
    });
    const brands = ['Evos', 'The Burger', 'Sushi Box'];
    for (const name of brands) {
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        await prisma.brand.upsert({
            where: { slug },
            update: {},
            create: { name, slug },
        });
    }
    await prisma.campaign.upsert({
        where: { id: 1 },
        update: {},
        create: {
            title: 'Розыгрыш квартиры 2026',
            description: 'Главный розыгрыш года — квартира за покупки в ресторанах!',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            sumPerVoucher: 300000,
            minVouchers: 10,
            minBrands: 3,
            isActive: true,
        },
    });
    console.log('Seed completed');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map