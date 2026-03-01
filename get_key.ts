import { prisma } from './packages/db';

async function main() {
    const key = await prisma.apiKey.findFirst({
        where: {
            disabled: false,
            deleted: false
        }
    });

    if (key) {
        console.log(key.apiKey);
    } else {
        console.error("No active key found");
    }
}

main().finally(() => prisma.$disconnect());
