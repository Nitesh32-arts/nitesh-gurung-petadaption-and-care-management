"""
Signal to broadcast new messages over WebSocket so real-time chat works.
Does not change REST or permission logic.
"""
import json
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Message


def _message_payload(msg):
    """Build JSON-serializable payload for WebSocket (matches frontend message shape)."""
    attachment_url = None
    if getattr(msg, "attachment", None) and msg.attachment:
        attachment_url = (settings.MEDIA_URL + msg.attachment.name).replace("//", "/")
    return {
        "id": msg.id,
        "sender": msg.sender_id,
        "sender_info": {
            "id": msg.sender_id,
            "username": getattr(msg.sender, "username", ""),
            "email": getattr(msg.sender, "email", ""),
            "first_name": getattr(msg.sender, "first_name", ""),
            "last_name": getattr(msg.sender, "last_name", ""),
        },
        "recipient": msg.recipient_id,
        "recipient_info": {
            "id": msg.recipient_id,
            "username": getattr(msg.recipient, "username", ""),
            "email": getattr(msg.recipient, "email", ""),
        },
        "subject": msg.subject or "Message",
        "body": msg.body or "",
        "attachment_name": getattr(msg, "attachment_name", "") or "",
        "attachment_url": attachment_url,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "related_pet": msg.related_pet_id,
    }


@receiver(post_save, sender=Message)
def broadcast_new_message(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        room_name = f"chat_{min(instance.sender_id, instance.recipient_id)}_{max(instance.sender_id, instance.recipient_id)}"
        payload = _message_payload(instance)

        async_to_sync(channel_layer.group_send)(
            room_name,
            {
                "type": "chat_message",
                "payload": payload,
            },
        )
    except Exception:
        pass  # Do not break message save if broadcast fails
