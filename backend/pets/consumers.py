"""
WebSocket consumer for real-time chat. Authenticates via JWT in query string.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """One consumer per connection. User joins group chat_user_<user_id> for push."""

    async def connect(self):
        self.user = None
        self.user_group = None
        token = self.scope.get("query_string", b"").decode().split("token=")
        token = token[1].split("&")[0].strip() if len(token) > 1 else None
        if not token:
            await self.close(code=4401)
            return
        self.user = await self._get_user_from_token(token)
        if not self.user:
            await self.close(code=4401)
            return
        self.user_group = f"chat_user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.user_group:
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

    async def chat_message(self, event):
        """Called when channel layer sends to this consumer's group. Forward to WebSocket."""
        await self.send(text_data=json.dumps(event.get("payload") or event))

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            access = AccessToken(token)
            return User.objects.get(pk=access["user_id"])
        except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
            return None
