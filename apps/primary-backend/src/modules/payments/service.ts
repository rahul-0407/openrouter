import { prisma } from "db"

const ONRAMP_AMOUNT = 1000;

export abstract class PaymentsService {

    static async onramp(userId: number) {
        const [user] = await prisma.$transaction([
            prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    walletBalance: {
                        increment: ONRAMP_AMOUNT
                    }
                }
            }),
            prisma.onrampTransaction.create({
                data: {
                    userId,
                    amount: ONRAMP_AMOUNT,
                    status: "completed"
                }
            }),
            prisma.walletTransaction.create({
                data: {
                    userId,
                    amount: ONRAMP_AMOUNT,
                    type: "CREDIT",
                    description: "Wallet top-up"
                }
            })
        ])

        return user.walletBalance;
    }
}