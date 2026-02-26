"""
WebSocket consumer for real-time chat. One room per conversation (pair of users).
Authenticates via JWT in query string; only allowed chat partners can join the room.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Room name: chat_{min_user_id}_{max_user_id} so both participants join the same room.
    URL: ws/chat/<other_user_id>/?token=<jwt>
    """

    async def connect(self):
        self.room_group_name = None
        self.user = None

        # Parse other_user_id from URL
        other_user_id = self.scope["url_route"]["kwargs"].get("other_user_id")
        try:
            other_user_id = int(other_user_id)
        except (TypeError, ValueError):
            await self.close(code=4400)
            return

        # JWT from query string
        qs = self.scope.get("query_string", b"").decode()
        token = None
        for part in qs.split("&"):
            if part.startswith("token="):
                token = part.split("=", 1)[1].strip()
                break
        if not token:
            await self.close(code=4401)
            return

        self.user = await self._get_user_from_token(token)
        if not self.user:
            await self.close(code=4401)
            return

        # Only participants of this conversation can join (reuse REST permission logic)
        allowed = await self._get_allowed_chat_partners(self.user)
        if other_user_id not in allowed:
            await self.close(code=4403)
            return

        # Canonical room name so both users join the same room
        a, b = self.user.id, other_user_id
        self.room_group_name = f"chat_{min(a, b)}_{max(a, b)}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Broadcast presence: user is online (other participant in this conversation)
        try:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "user_online",
                    "user_id": self.user.id,
                    "username": getattr(self.user, "username", ""),
                },
            )
        except Exception:
            pass

    async def disconnect(self, close_code):
        if self.room_group_name:
            try:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "user_offline",
                        "user_id": self.user.id,
                        "username": getattr(self.user, "username", ""),
                    },
                )
            except Exception:
                pass
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        """
        Optional: relay client messages (e.g. typing). Messages are persisted via REST only.
        If client sends {"type": "typing"}, we can broadcast; else ignore or echo.
        """
        try:
            data = json.loads(text_data)
            if data.get("type") == "typing":
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_typing",
                        "user_id": self.user.id,
                        "username": getattr(self.user, "username", ""),
                    },
                )
            elif data.get("type") == "stop_typing":
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_stop_typing",
                        "user_id": self.user.id,
                    },
                )
        except (json.JSONDecodeError, KeyError):
            pass

    async def chat_message(self, event):
        """Broadcast new message (from backend after save) to everyone in the room."""
        payload = event.get("payload") or event
        await self.send(text_data=json.dumps(payload))

    async def chat_typing(self, event):
        """Broadcast typing indicator (do not send to sender; they know they're typing)."""
        if event.get("user_id") == self.user.id:
            return
        await self.send(text_data=json.dumps({
            "type": "typing",
            "user_id": event.get("user_id"),
            "username": event.get("username", ""),
        }))

    async def chat_stop_typing(self, event):
        """Broadcast stop typing."""
        await self.send(text_data=json.dumps({
            "type": "stop_typing",
            "user_id": event.get("user_id"),
        }))

    async def message_read(self, event):
        """Broadcast read receipts so sender sees checkmarks."""
        await self.send(text_data=json.dumps({
            "type": "message_read",
            "message_ids": event.get("message_ids", []),
            "read_at": event.get("read_at"),
        }))

    async def user_online(self, event):
        """Broadcast presence: do not send to self."""
        if event.get("user_id") == self.user.id:
            return
        await self.send(text_data=json.dumps({
            "type": "user_online",
            "user_id": event.get("user_id"),
            "username": event.get("username", ""),
        }))

    async def user_offline(self, event):
        """Broadcast presence."""
        if event.get("user_id") == self.user.id:
            return
        await self.send(text_data=json.dumps({
            "type": "user_offline",
            "user_id": event.get("user_id"),
            "username": event.get("username", ""),
        }))

    async def reaction_update(self, event):
        """Broadcast reaction change."""
        await self.send(text_data=json.dumps({
            "type": "reaction_update",
            "message_id": event.get("message_id"),
            "reactions": event.get("reactions", []),
        }))

    async def message_deleted(self, event):
        """Broadcast unsend: notify both participants to update UI."""
        await self.send(text_data=json.dumps({
            "type": "message_deleted",
            "message_id": event.get("message_id"),
        }))

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
            access = AccessToken(token)
            return User.objects.get(pk=access["user_id"])
        except Exception:
            return None

    @database_sync_to_async
    def _get_allowed_chat_partners(self, user):
        from pets.views import get_allowed_chat_partners
        return get_allowed_chat_partners(user)
