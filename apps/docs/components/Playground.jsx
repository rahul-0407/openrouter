"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
    Send, 
    Trash2, 
    Key, 
    Bot, 
    User, 
    Loader2, 
    Sparkles,
    AlertCircle,
    CheckCircle2
} from "lucide-react";

const API_BASE = "http://localhost:4000";
const MODELS_API = "http://localhost:3000/models";

export function Playground() {
    const [apiKey, setApiKey] = useState("");
    const [selectedModel, setSelectedModel] = useState("");
    const [models, setModels] = useState([]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch(MODELS_API);
                const data = await res.json();
                const availableModels = data.filter((m) => m.available);
                setModels(availableModels);
                if (availableModels.length > 0 && !selectedModel) {
                    setSelectedModel(availableModels[0].slug);
                }
            } catch (err) {
                console.error("Failed to fetch models", err);
            }
        };
        fetchModels();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !selectedModel || !apiKey || isLoading) return;

        const newMessages = [...messages, { role: "user", content: input }];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/v1/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: newMessages,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "Failed to send message");
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No reader available");

            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            let assistantContent = "";
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6);
                        if (dataStr === "[DONE]") break;

                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content || "";
                            assistantContent += content;
                            
                            setMessages((prev) => {
                                const newPrev = [...prev];
                                newPrev[newPrev.length - 1].content = assistantContent;
                                return newPrev;
                            });
                        } catch (e) {
                            // Ignore partial JSON
                        }
                    }
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[700px] border border-gray-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 overflow-hidden shadow-sm mt-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
                <div className="flex-1 flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-indigo-500" />
                    </div>
                    <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-transparent border-none text-sm font-semibold focus:ring-0 cursor-pointer min-w-[150px]"
                    >
                        {models.map((m) => (
                            <option key={m.slug} value={m.slug}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                        <input 
                            type="password"
                            placeholder="OpenRouter API Key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            {apiKey ? (
                                <CheckCircle2 className="size-3 text-emerald-500" />
                            ) : (
                                <div className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setMessages([])}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 transition-colors"
                        title="Clear conversation"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-neutral-800">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                        <div className="size-16 rounded-3xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                            <Bot className="size-8 text-gray-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">No messages yet</p>
                            <p className="text-xs max-w-[200px]">Send a message to start playing with the API.</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 pt-4">
                            {["Tell me a joke", "Write a python script", "Explain quantum physics"].map(p => (
                                <button 
                                    key={p}
                                    onClick={() => setInput(p)}
                                    className="px-3 py-1 text-xs rounded-full border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {m.role === 'assistant' && (
                                <div className="size-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
                                    <Bot className="size-4 text-white" />
                                </div>
                            )}
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                                m.role === 'user' 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100'
                            }`}>
                                <pre className="whitespace-pre-wrap font-sans leading-relaxed">{m.content}</pre>
                            </div>
                            {m.role === 'user' && (
                                <div className="size-8 rounded-lg bg-gray-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                                    <User className="size-4 text-gray-600 dark:text-gray-300" />
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
                {error && (
                    <div className="mb-4 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-xs">
                        <AlertCircle className="size-3.5" />
                        <span>{error}</span>
                    </div>
                )}
                
                <div className="relative">
                    <textarea 
                        rows={3}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type your message..."
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-sm"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || !apiKey || isLoading}
                        className="absolute right-2.5 bottom-2.5 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {isLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Send className="size-4" />
                        )}
                    </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">
                        Press Enter to send, Shift+Enter for new line.
                    </p>
                    <p className="text-[10px] text-gray-400">
                        Don't have a key? <a href="http://localhost:3001/api-keys" className="text-indigo-500 hover:underline">Get one here</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
