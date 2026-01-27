import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import { toast } from "react-hot-toast";

export default function ChatPanel({ visitId }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

    useEffect(() => {
        if (visitId) {
            fetchMessages();
        }
    }, [visitId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/kunjungan/${visitId}/messages`);
            if (res.data.success) {
                setMessages(res.data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch messages", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            const res = await api.post(`/kunjungan/${visitId}/messages`, {
                message: newMessage.trim()
            });
            if (res.data.success) {
                setMessages(prev => [...prev, res.data.data]);
                setNewMessage("");
            }
        } catch (err) {
            toast.error("Gagal mengirim pesan");
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="flex flex-col h-96 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-blue-900 text-white px-4 py-3 flex items-center gap-2">
                <Icon icon="mdi:message-text" width={20} />
                <span className="font-semibold text-sm">Chat dengan Koordinator</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Icon icon="svg-spinners:180-ring-with-bg" width={32} className="text-blue-900" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                        <Icon icon="mdi:chat-outline" width={48} className="mb-2 opacity-30" />
                        <p>Belum ada pesan</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user.id === currentUser.id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[75%] rounded-lg px-3 py-2 ${isOwn
                                            ? "bg-blue-600 text-white"
                                            : "bg-white border border-slate-200 text-slate-800"
                                        }`}
                                >
                                    <p className="text-xs font-semibold mb-1 opacity-75">
                                        {msg.user.name || msg.user.email}
                                    </p>
                                    <p className="text-sm leading-relaxed">{msg.message}</p>
                                    <p className={`text-[10px] mt-1 ${isOwn ? "text-blue-100" : "text-slate-400"}`}>
                                        {formatTime(msg.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                <input
                    type="text"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Ketik pesan..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                />
                <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    {sending ? (
                        <Icon icon="svg-spinners:ring-resize" width={18} />
                    ) : (
                        <Icon icon="mdi:send" width={18} />
                    )}
                </button>
            </form>
        </div>
    );
}
