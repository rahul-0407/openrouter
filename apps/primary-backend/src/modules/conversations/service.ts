import { prisma } from "db";

export abstract class ConversationService {
    static async listConversations(userId: number) {
        return prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    }

    static async getConversation(userId: number, id: string) {
        return prisma.conversation.findFirst({
            where: { id, userId },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" }
                }
            }
        });
    }

    static async createConversation(userId: number, title?: string) {
        return prisma.conversation.create({
            data: {
                userId,
                title: title || "New Chat",
            }
        });
    }

    static async addMessage(conversationId: string, role: string, content: string, model?: string) {
        return prisma.message.create({
            data: {
                conversationId,
                role,
                content,
                model
            }
        });
    }

    static async deleteConversation(userId: number, id: string) {
        return prisma.conversation.deleteMany({
            where: { id, userId }
        });
    }

    static async updateTitle(userId: number, id: string, title: string) {
        return prisma.conversation.updateMany({
            where: { id, userId },
            data: { title }
        });
    }
}
