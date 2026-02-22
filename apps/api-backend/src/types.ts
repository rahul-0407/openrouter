import { t } from "elysia"

export const Message = t.Array(t.Object({
    role: t.Enum({ user: 'user', assistant: 'assistant' }),
    content: t.String()
}))

export type Messages = typeof Message.static

export const Conversation = t.Object({
    model: t.String(),
    messages: Message
})

