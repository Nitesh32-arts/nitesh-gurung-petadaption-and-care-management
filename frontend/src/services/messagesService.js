/**
 * Shared Messages / Chat API for Adopter, Shelter, and Veterinarian.
 * Uses backend: GET/POST /api/messages/ with role-based allowed partners.
 */
import apiClient from '../apiClient';

export const messagesService = {
  /**
   * Fetch conversation list (distinct chat partners with last message and unread count).
   */
  getConversations: async () => {
    try {
      const response = await apiClient.get('/messages/conversations/');
      const raw = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      return raw.map((c) => ({
        id: c.id,
        otherUserId: c.other_user_id ?? c.otherUserId ?? c.other_party?.id ?? c.other_party?.pk ?? c.id,
        otherParty: c.other_party ?? c.otherParty,
        lastMessage: c.last_message ?? c.lastMessage,
        unreadCount: c.unread_count ?? c.unreadCount ?? 0,
      }));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      return [];  // Degrade gracefully: show "No conversations yet" instead of error message
    }
  },

  /**
   * Fetch message history with a user, ordered old -> new.
   */
  getMessages: async (otherPartyId) => {
    const uid = otherPartyId != null ? Number(otherPartyId) : null;
    if (uid == null || Number.isNaN(uid)) return [];
    try {
      const response = await apiClient.get('/messages/thread/', {
        params: { user_id: uid },
      });
      const data = response.data?.results ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.response?.status === 403) return [];
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  },

  /**
   * Send a message. Prefer subject "Message" for chat.
   * If file is provided, sends as multipart/form-data (body optional).
   */
  send: async (recipientId, subject, content, petId = null, file = null) => {
    const rid = recipientId != null ? Number(recipientId) : null;
    if (rid == null || Number.isNaN(rid)) throw new Error('Invalid recipient.');
    const body = (content || '').trim();
    if (!body && !file) throw new Error('Message must have text or a document.');

    if (file) {
      const form = new FormData();
      form.append('recipient', rid);
      form.append('subject', subject || 'Message');
      if (body) form.append('body', body);
      if (petId != null) form.append('related_pet', petId);
      form.append('attachment', file, file.name || 'document');
      const response = await apiClient.post('/messages/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }

    const payload = {
      recipient: rid,
      subject: subject || 'Message',
      body,
    };
    if (petId != null) payload.related_pet = petId;
    const response = await apiClient.post('/messages/', payload);
    return response.data;
  },

  /**
   * Unsend (soft-delete) a message. Sender only. DELETE /api/messages/<id>/
   */
  unsend: async (messageId) => {
    await apiClient.delete(`/messages/${messageId}/`);
  },

  /**
   * Mark a single message as read.
   */
  markRead: async (messageId) => {
    await apiClient.post(`/messages/${messageId}/mark_read/`);
  },

  /**
   * Mark all messages from a conversation partner as read.
   */
  markConversationRead: async (otherUserId) => {
    try {
      await apiClient.post('/messages/mark_conversation_read/', {
        other_user: otherUserId,
      });
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  },

  /**
   * Get unread message count for current user.
   */
  getUnreadCount: async () => {
    try {
      const response = await apiClient.get('/messages/unread_count/');
      return response.data?.count ?? 0;
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      return 0;
    }
  },

  /**
   * Get users the current user is allowed to start a chat with.
   * Returns: [{ user_id, name, role, pet_name? }]
   */
  getAllowedPartners: async () => {
    try {
      const response = await apiClient.get('/messages/allowed_partners/');
      const raw = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      return raw.map((p) => ({
        user_id: p.user_id,
        name: p.name || p.username || 'User',
        role: p.role,
        pet_name: p.pet_name ?? null,
      }));
    } catch (error) {
      if (error.response?.status === 403) return [];
      console.error('Failed to fetch allowed partners:', error);
      throw error;
    }
  },
};

export default messagesService;
