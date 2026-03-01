import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useRef, useState, useCallback } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Send, Loader2, Bot, User, AlertCircle, MessageSquare, History, Plus, Trash2 } from "lucide-react";

const API_BASE = "http://localhost:4000";
const BACKEND_BASE = "http://localhost:3000";

type Message = {
    role: "user" | "assistant";
    content: string;
};

type Model = {
    id: string;
    name: string;
    slug: string;
    available: boolean;
    company: { id: string; name: string; website: string };
};

// ── Streaming SSE Client ──────────────────────────────────────────────

async function streamChat(
    apiKey: string,
    model: string,
    messages: Message[],
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
    conversationId?: string | null,
) {
    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: "POST",
        credentials: "include", 
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ 
            model, 
            messages, 
            stream: true,
            conversation_id: conversationId 
        }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Request failed" }));
        onError(body.message ?? `HTTP ${res.status}`);
        return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
        onError("No response stream");
        return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") {
                onDone();
                return;
            }
            try {
                const parsed = JSON.parse(payload);
                if (parsed.error) {
                    onError(parsed.error.message ?? "Stream error");
                    return;
                }
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) onToken(token);
            } catch {
                // skip malformed chunks
            }
        }
    }
    onDone();
}

// ── Chat Page ─────────────────────────────────────────────────────────

export function Chat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const [selectedModel, setSelectedModel] = useState("");
    const [models, setModels] = useState<Model[]>([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [conversations, setConversations] = useState<any[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch models
    useEffect(() => {
        fetch(`${BACKEND_BASE}/models`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                const allModels = data.models ?? [];
                setModels(allModels);
                // Auto-select first available model
                const firstAvailable = allModels.find((m: Model) => m.available);
                if (firstAvailable) {
                    setSelectedModel(firstAvailable.slug);
                } else if (allModels.length > 0) {
                    setSelectedModel(allModels[0].slug);
                }
            })
            .catch(() => setError("Failed to load models"))
            .finally(() => setModelsLoading(false));
    }, []);

    // Fetch API key
    useEffect(() => {
        fetch(`${BACKEND_BASE}/api-keys`, { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                const keys = data.apiKeys ?? [];
                const active = keys.find((k: any) => !k.disabled && !k.deleted);
                if (active) setApiKey(active.apiKey);
            })
            .catch(() => {});
    }, []);

    // Fetch history
    const fetchHistory = useCallback(() => {
        setHistoryLoading(true);
        fetch(`${BACKEND_BASE}/conversations`, { credentials: "include" })
            .then(r => r.json())
            .then(data => setConversations(data))
            .catch(() => {})
            .finally(() => setHistoryLoading(false));
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const loadConversation = async (id: string) => {
        if (isSending) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`${BACKEND_BASE}/conversations/${id}`, { credentials: "include" });
            const data = await res.json();
            if (data.messages) {
                setMessages(data.messages.map((m: any) => ({
                    role: m.role,
                    content: m.content
                })));
                setCurrentConversationId(id);
            }
        } catch (err) {
            setError("Failed to load conversation");
        } finally {
            setHistoryLoading(false);
        }
    };

    const startNewChat = () => {
        if (isSending) return;
        setMessages([]);
        setCurrentConversationId(null);
        setStreamingContent("");
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent]);

    // Dismiss error after 5s
    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(t);
        }
    }, [error]);

    const handleSend = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isSending || !selectedModel) return;

        if (!apiKey) {
            setError("No API key found. Create one in API Keys.");
            return;
        }

        const userMsg: Message = { role: "user", content: trimmed };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput("");
        setIsSending(true);
        setStreamingContent("");

        let accumulated = "";
        try {
            await streamChat(
                apiKey,
                selectedModel,
                updatedMessages,
                (token) => {
                    accumulated += token;
                    setStreamingContent(accumulated);
                },
                () => {
                    if (accumulated) {
                        setMessages((prev) => [
                            ...prev,
                            { role: "assistant", content: accumulated },
                        ]);
                    }
                    setStreamingContent("");
                    setIsSending(false);
                    // Refresh history to catch the new conversation/title
                    fetchHistory();
                },
                (errMsg) => {
                    setError(errMsg);
                    if (accumulated) {
                        setMessages((prev) => [
                            ...prev,
                            { role: "assistant", content: accumulated },
                        ]);
                    }
                    setStreamingContent("");
                    setIsSending(false);
                },
                currentConversationId
            );
        } catch (err) {
            setError("Network error");
            setStreamingContent("");
            setIsSending(false);
        }
    }, [input, isSending, selectedModel, apiKey, messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Streaming conversation with AI models.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 ">
                        {modelsLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <Loader2 className="size-3.5 animate-spin" />
                                Loading models...
                            </div>
                        ) : (
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="w-[280px] bg-card/50 border-border/50">
                                    <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {models.map((m) => (
                                        <SelectItem
                                            key={m.slug}
                                            value={m.slug}
                                            disabled={!m.available}
                                            className={!m.available ? "opacity-50 cursor-not-allowed" : ""}
                                        >
                                            <span className="font-mono text-xs" title={!m.available ? "Provider not available" : undefined}>
                                                {m.slug}
                                                {!m.available && (
                                                    <span className="ml-2 text-muted-foreground/60 text-[10px] font-sans">
                                                        (unavailable)
                                                    </span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto py-6 space-y-4 min-h-0">
                        {messages.length === 0 && !isSending && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/5 border border-primary/10 mb-4">
                                    <Bot className="size-7 text-primary/60" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground/80">
                                    Start a conversation
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                                    Select a model and type a message below to begin.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <MessageBubble key={i} message={msg} />
                        ))}

                        {/* Streaming assistant message */}
                        {isSending && streamingContent && (
                            <MessageBubble
                                message={{ role: "assistant", content: streamingContent }}
                                isStreaming
                            />
                        )}

                        {/* Typing indicator */}
                        {isSending && !streamingContent && (
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                                    <Bot className="size-4 text-primary" />
                                </div>
                                <div className="bg-card/60 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                                        <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                                        <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Error toast */}
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-2.5 mb-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                            <AlertCircle className="size-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Input */}
                    <div className="border-t border-border/50 pt-4 pb-2">
                        <div className="flex items-end gap-3">
                            <div className="flex-1 relative">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isSending}
                                    placeholder={
                                        isSending
                                            ? "Waiting for response..."
                                            : "Type a message... (Enter to send)"
                                    }
                                    rows={1}
                                    className="w-full resize-none rounded-xl border border-border/50 bg-card/30 px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white"
                                    style={{ minHeight: "48px", maxHeight: "120px" }}
                                    onInput={(e) => {
                                        const t = e.target as HTMLTextAreaElement;
                                        t.style.height = "auto";
                                        t.style.height = Math.min(t.scrollHeight, 120) + "px";
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={isSending || !input.trim() || !selectedModel}
                                className="flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                            >
                                {isSending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Send className="size-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

// ── Message Bubble ────────────────────────────────────────────────────

function MessageBubble({
    message,
    isStreaming,
}: {
    message: Message;
    isStreaming?: boolean;
}) {
    const isUser = message.role === "user";

    return (
        <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
            <div
                className={`flex items-center justify-center size-8 rounded-lg border shrink-0 ${
                    isUser
                        ? "bg-accent/50 border-border/30"
                        : "bg-primary/10 border-primary/20"
                }`}
            >
                {isUser ? (
                    <User className="size-4 text-muted-foreground" />
                ) : (
                    <Bot className="size-4 text-primary" />
                )}
            </div>
            <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
                    isUser
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card/60 border border-border/40 text-foreground rounded-tl-sm"
                }`}
            >
                {message.content}
                {isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse rounded-sm align-middle" />
                )}
            </div>
        </div>
    );
}
