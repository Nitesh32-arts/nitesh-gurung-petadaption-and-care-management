import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, ArrowLeft, Trash2, Paperclip, FileText } from 'lucide-react';
import { messagesService } from '../services/messagesService';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useAuth } from '../hooks/useAuth';

const Messaging = ({ recipientId, recipientName, petId = null, onClose, currentUserId, onUnreadChange, embedded }) => {
  const { accessToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!recipientId) return;
    try {
      const list = await messagesService.getMessages(recipientId);
      setMessages(list);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  // Real-time: when backend broadcasts a new message or message_deleted
  const handleWsMessage = useCallback((data) => {
    if (data.type === 'typing') {
      setTypingUser(data.username || data.user_id);
      setTimeout(() => setTypingUser(null), 3000);
      return;
    }
    if (data.type === 'message_deleted' && data.message_id != null) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id ? { ...m, is_deleted: true, body: null } : m
        )
      );
      return;
    }
    if (data.id != null && data.body != null) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        const senderId = data.sender_info?.id ?? data.sender;
        const isFromMe = senderId === currentUserId;
        if (isFromMe && prev.some((m) => String(m.id).startsWith('temp-'))) {
          return prev.filter((m) => !String(m.id).startsWith('temp-')).concat([data]);
        }
        return [...prev, data];
      });
      onUnreadChange?.();
    }
  }, [onUnreadChange, currentUserId]);

  const { isConnected: wsConnected } = useChatWebSocket(recipientId, accessToken, {
    enabled: !!recipientId && !!accessToken,
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    if (!recipientId) return;
    setLoading(true);
    loadMessages();
    messagesService.markConversationRead(recipientId);
    if (onUnreadChange) {
      messagesService.getUnreadCount().then(onUnreadChange);
    }
    // Polling fallback: slower when WebSocket is connected, else every 10s
    const interval = setInterval(loadMessages, wsConnected ? 30000 : 10000);
    return () => clearInterval(interval);
  }, [recipientId, loadMessages, onUnreadChange, wsConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if ((!text && !attachment) || sending) return;

    setSending(true);
    setSendError(null);
    const optimistic = {
      id: `temp-${Date.now()}`,
      sender: currentUserId,
      sender_info: { id: currentUserId },
      recipient: recipientId,
      body: text || (attachment?.name ? `📎 ${attachment.name}` : ''),
      attachment_name: attachment?.name,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');
    const fileToSend = attachment;
    setAttachment(null);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const created = await messagesService.send(recipientId, 'Message', text, petId, fileToSend || undefined);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id).concat([created]));
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError('Failed to send. Please try again.');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(text);
      if (fileToSend) setAttachment(fileToSend);
    } finally {
      setSending(false);
      if (onUnreadChange) messagesService.getUnreadCount().then(onUnreadChange);
    }
  };

  const handleAttachClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
    e.target.value = '';
  };

  const handleUnsend = async (msg) => {
    if (!msg?.id || msg.is_deleted) return;
    const senderId = msg.sender_info?.id ?? msg.sender;
    if (senderId !== currentUserId) return;
    try {
      await messagesService.unsend(msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_deleted: true, body: null } : m))
      );
    } catch (err) {
      console.error('Failed to unsend message:', err);
      setSendError(err.response?.data?.detail || 'Failed to unsend message.');
    }
  };

  return (
    <div className={`bg-white flex flex-col ${embedded ? 'h-full min-h-0' : 'rounded-xl shadow-md h-[600px]'}`}>
      <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {recipientName || 'Chat'}
          </h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {sendError && (
          <p className="text-sm text-red-600 text-center py-2">{sendError}</p>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No messages yet. Start the conversation!</p>
        ) : (
          <>
          {messages.map((msg) => {
            const isOwn = msg.sender?.id === currentUserId || msg.sender === currentUserId;
            const deleted = msg.is_deleted === true;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 relative ${
                    isOwn ? 'bg-primary text-white' : 'bg-gray-100 text-gray-900'
                  } ${deleted ? 'opacity-80' : ''}`}
                >
                  {deleted ? (
                    <p className="text-sm italic flex items-center gap-1">
                      <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                      This message was deleted
                    </p>
                  ) : (
                    <>
                      {msg.body || msg.content ? (
                        <p className="text-sm">{msg.body || msg.content}</p>
                      ) : null}
                      {(msg.attachment_url || msg.attachment_name) && (
                        <a
                          href={msg.attachment_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 mt-1 text-sm underline ${isOwn ? 'text-white/95' : 'text-primary'}`}
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          {msg.attachment_name || 'Document'}
                        </a>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {isOwn && !deleted && (
                      <button
                        type="button"
                        onClick={() => handleUnsend(msg)}
                        className="text-xs opacity-70 hover:opacity-100 underline"
                        title="Unsend"
                      >
                        Unsend
                      </button>
                    )}
                    <p className={`text-xs ${isOwn ? 'text-white/75' : 'text-gray-500'}`}>
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {typingUser && (
          <p className="text-xs text-gray-500 italic py-1">{typingUser} is typing...</p>
        )}
        <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t flex gap-2 items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
        />
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={sending}
          className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          title="Attach document"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={attachment ? attachment.name : 'Type a message...'}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || (!newMessage.trim() && !attachment)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
      {attachment && (
        <p className="px-4 pb-1 text-xs text-gray-500 flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {attachment.name}
          <button type="button" onClick={() => setAttachment(null)} className="text-red-500 hover:underline ml-1">Remove</button>
        </p>
      )}
    </div>
  );
};

export default Messaging;

