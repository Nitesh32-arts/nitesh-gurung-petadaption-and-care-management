/**
 * Messenger-style global chat: fixed bottom-right icon, floating popup with
 * left panel (conversation list) and right panel (thread). Visible when authenticated.
 * Persists across page navigation. "New Message" shows allowed partners only.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, X, Plus } from 'lucide-react';
import { messagesService } from '../services/messagesService';
import Messaging from './Messaging';
import { useAuth } from '../hooks/useAuth';

const GlobalChatPopup = () => {
  const { user: authUser, accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedConv, setSelectedConv] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [allowedPartners, setAllowedPartners] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const pendingOpenRef = useRef(null);

  const currentUserId = authUser?.id ?? authUser?.pk ?? null;
  const isAuthenticated = !!(accessToken && authUser);

  const loadUnreadCount = useCallback(async () => {
    if (!authUser) return;
    try {
      const count = await messagesService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [authUser]);

  const loadConversations = useCallback(async () => {
    if (!authUser) return;
    try {
      setError(null);
      const convs = await messagesService.getConversations();
      setConversations(convs);
      await loadUnreadCount();
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [loadUnreadCount, authUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadUnreadCount();
  }, [isAuthenticated, loadUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleOpen = (e) => {
      const detail = e?.detail ?? {};
      setOpen(true);
      if (detail.userId != null) {
        pendingOpenRef.current = {
          userId: detail.userId,
          petId: detail.petId ?? null,
          name: detail.name ?? null,
        };
      } else {
        pendingOpenRef.current = null;
      }
    };
    window.addEventListener('openChat', handleOpen);
    return () => window.removeEventListener('openChat', handleOpen);
  }, [isAuthenticated]);

  useEffect(() => {
    if (open && currentUserId) {
      setLoading(true);
      loadConversations();
      const interval = setInterval(loadConversations, 15000);
      return () => clearInterval(interval);
    }
  }, [open, currentUserId, loadConversations]);

  useEffect(() => {
    if (!open || !currentUserId) return;
    const pending = pendingOpenRef.current;
    if (!pending?.userId) return;
    const existing = conversations.find(
      (c) => (c.otherUserId ?? c.otherParty?.id ?? c.otherParty?.pk) == pending.userId
    );
    if (existing) {
      setSelectedConv(existing);
      setShowNewMessage(false);
    } else {
      setSelectedConv({
        id: String(pending.userId),
        otherUserId: pending.userId != null ? Number(pending.userId) : null,
        otherParty: { id: pending.userId, username: pending.name || 'User' },
        related_pet: pending.petId != null ? { id: pending.petId } : undefined,
      });
      setShowNewMessage(false);
    }
    pendingOpenRef.current = null;
  }, [open, currentUserId, conversations]);

  const handleSelectConversation = (conv) => {
    setSelectedConv(conv);
    setShowNewMessage(false);
  };

  const handleCloseThread = () => {
    setSelectedConv(null);
    loadConversations();
  };

  const handleNewMessageClick = async () => {
    setShowNewMessage(true);
    setLoadingPartners(true);
    setAllowedPartners([]);
    try {
      const list = await messagesService.getAllowedPartners();
      setAllowedPartners(list);
    } catch (err) {
      console.error('Failed to load allowed partners:', err);
      setError('Failed to load people you can message.');
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleSelectPartner = (partner) => {
    setSelectedConv({
      id: String(partner.user_id),
      otherUserId: partner.user_id != null ? Number(partner.user_id) : null,
      otherParty: { id: partner.user_id, username: partner.name },
      related_pet: partner.pet_name ? { id: null } : undefined,
    });
    setShowNewMessage(false);
  };

  const handleUnreadChange = useCallback(() => {
    loadUnreadCount();
    loadConversations();
  }, [loadUnreadCount, loadConversations]);

  const filteredConversations = conversations.filter((conv) => {
    const name = conv.otherParty?.username || conv.otherParty?.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (!isAuthenticated) return null;
  const userId = currentUserId;

  return (
    <>
      {/* Fixed bottom-right chat icon with unread badge */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-emerald-600 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Open messages"
      >
        <MessageCircle className="w-7 h-7" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating popup: two panels */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl flex w-full max-w-4xl h-[600px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left panel: conversation list */}
            <div className="w-[320px] border-r flex flex-col bg-gray-50">
              <div className="p-3 border-b bg-white flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">Messages</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleNewMessageClick}
                    className="p-1.5 hover:bg-gray-100 rounded text-primary"
                    title="New message"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              {!showNewMessage && (
                <div className="p-2 border-b bg-white">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {error && <p className="text-sm text-red-600 px-3 py-2">{error}</p>}
                {showNewMessage ? (
                  <>
                    <div className="p-2 flex items-center justify-between border-b bg-white">
                      <span className="text-sm font-medium text-gray-700">Choose who to message</span>
                      <button
                        type="button"
                        onClick={() => { setShowNewMessage(false); setError(null); }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Back
                      </button>
                    </div>
                    {loadingPartners ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    ) : allowedPartners.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No one to message yet.</p>
                    ) : (
                      <div className="divide-y">
                        {allowedPartners.map((partner) => (
                          <button
                            key={partner.user_id}
                            type="button"
                            onClick={() => handleSelectPartner(partner)}
                            className="w-full p-3 text-left hover:bg-gray-100 flex flex-col"
                          >
                            <p className="font-medium text-gray-900">{partner.name}</p>
                            <p className="text-xs text-gray-500">
                              {partner.role}
                              {partner.pet_name ? ` • ${partner.pet_name}` : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No conversations yet.</p>
                ) : (
                  <div className="divide-y">
                    {filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => handleSelectConversation(conv)}
                        className={`w-full p-3 text-left flex items-center justify-between hover:bg-gray-100 ${
                          selectedConv?.otherUserId === conv.otherUserId ||
                          selectedConv?.id === conv.id ||
                          (selectedConv?.otherParty?.id ?? selectedConv?.otherParty?.pk) === (conv.otherParty?.id ?? conv.otherParty?.pk)
                            ? 'bg-primary/10'
                            : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {conv.otherParty?.username || conv.otherParty?.email || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {conv.lastMessage?.is_deleted
                              ? 'This message was deleted'
                              : conv.lastMessage?.body || conv.lastMessage?.content || 'No messages'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          {conv.unreadCount > 0 && (
                            <span className="inline-block bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: thread or placeholder */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              {selectedConv ? (
                <Messaging
                  recipientId={
                    selectedConv.otherUserId != null
                      ? Number(selectedConv.otherUserId)
                      : (selectedConv.otherParty?.id ?? selectedConv.otherParty?.pk ?? selectedConv.id) != null
                        ? Number(selectedConv.otherParty?.id ?? selectedConv.otherParty?.pk ?? selectedConv.id)
                        : null
                  }
                  recipientName={selectedConv.otherParty?.username || selectedConv.otherParty?.email || 'User'}
                  petId={selectedConv.related_pet?.id ?? null}
                  onClose={handleCloseThread}
                  currentUserId={userId}
                  onUnreadChange={handleUnreadChange}
                  embedded
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <p className="text-sm">Select a conversation</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalChatPopup;
