from django.urls import re_path
from .consumers import ChatConsumer

# URL: ws/chat/<other_user_id>/?token=<jwt>
# Room is chat_{min(user_id, other_user_id)}_{max(...)} so both participants share the same room.
websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<other_user_id>\d+)/$", ChatConsumer.as_asgi()),
]
