import { Elysia, t } from "elysia";
import { ConversationService } from "./service";

export const conversationApp = new Elysia({ prefix: "/conversations" })
    .get("/", async ({ set, auth, jwt }: any) => {
        const user = await auth(jwt);
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        return ConversationService.listConversations(user.id);
    })
    .get("/:id", async ({ set, params: { id }, auth, jwt }: any) => {
        const user = await auth(jwt);
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        const conversation = await ConversationService.getConversation(user.id, id);
        if (!conversation) {
            set.status = 404;
            return { message: "Not found" };
        }
        return conversation;
    })
    .post("/", async ({ set, body, auth, jwt }: any) => {
        const user = await auth(jwt);
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        return ConversationService.createConversation(user.id, body.title);
    }, {
        body: t.Object({
            title: t.Optional(t.String())
        })
    })
    .delete("/:id", async ({ set, params: { id }, auth, jwt }: any) => {
        const user = await auth(jwt);
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        await ConversationService.deleteConversation(user.id, id);
        return { success: true };
    })
    .patch("/:id/title", async ({ set, params: { id }, body, auth, jwt }: any) => {
        const user = await auth(jwt);
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        await ConversationService.updateTitle(user.id, id, body.title);
        return { success: true };
    }, {
        body: t.Object({
            title: t.String()
        })
    });
