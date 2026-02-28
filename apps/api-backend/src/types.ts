import { t } from "elysia"

export const Message = t.Array(t.Object({
    role: t.Enum({ user: 'user', assistant: 'assistant', system: 'system' }),
    content: t.String()
}))

export type Messages = typeof Message.static

export const Conversation = t.Object({
    model: t.String(),
    messages: Message,
    stream: t.Optional(t.Boolean()),
    temperature: t.Optional(t.Number()),
    max_tokens: t.Optional(t.Number()),
    conversation_id: t.Optional(t.String()),
    parent_id: t.Optional(t.String()),
})

// Permissive variant: accepts any additional fields OpenAI SDKs may send
// (top_p, frequency_penalty, presence_penalty, etc.)
export const OpenAIConversation = t.Object({
    model: t.String(),
    messages: Message,
    stream: t.Optional(t.Boolean()),
    temperature: t.Optional(t.Number()),
    max_tokens: t.Optional(t.Number()),
    conversation_id: t.Optional(t.String()),
}, { additionalProperties: true })
