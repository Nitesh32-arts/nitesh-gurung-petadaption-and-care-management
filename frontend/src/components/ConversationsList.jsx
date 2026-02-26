import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Search, X } from 'lucide-react';
import Messaging from './Messaging';
import { messagesService } from '../services/messagesService';

const ConversationsList = ({ currentUserId, onClose, onUnreadChange }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  const loadConversations = useCallback(async () => {
    try {
      setError(null);
      const convs = await messagesService.getConversations();
      setConversations(convs);
      if (onUnreadChange) {
        const count = await messagesService.getUnreadCount();
        onUnreadChange(count);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations. Please try again.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const filteredConversations = conversations.filter(conv => {
    const name = conv.otherParty?.username || conv.otherParty?.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleCloseMessaging = () => {
    setSelectedConversation(null);
    loadConversations();
  };

  if (selectedConversation) {
    return (
      <Messaging
        recipientId={selectedConversation.otherParty?.id || selectedConversation.id}
        recipientName={selectedConversation.otherParty?.username || 'User'}
        petId={selectedConversation.related_pet?.id}
        onClose={handleCloseMessaging}
        currentUserId={currentUserId}
        onUnreadChange={onUnreadChange}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Messages
          </h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <p className="text-sm text-red-600 text-center py-4 px-4">{error}</p>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No conversations yet.</p>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedConversation(conv)}
                className="w-full p-4 hover:bg-gray-50 text-left flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {conv.otherParty?.username || conv.otherParty?.email || 'Unknown User'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {conv.lastMessage?.is_deleted
                      ? 'This message was deleted'
                      : conv.lastMessage?.body || conv.lastMessage?.content || 'No messages'}
                  </p>
                </div>
                <div className="text-right">
                  {conv.unreadCount > 0 && (
                    <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">
                      {conv.unreadCount}
                    </span>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(conv.lastMessage?.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationsList;

