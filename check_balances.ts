import { prisma } from './packages/db';

async function main() {
    const users = await prisma.user.findMany({
        select: {
            email: true,
            walletBalance: true
        }
    });

    console.log("Users and their balances:");
    for (const user of users) {
        console.log(`- ${user.email}: ${user.walletBalance}`);
    }
}

main().finally(() => prisma.$disconnect());
