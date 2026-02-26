# Real-Time Chat (WebSocket)

Chat uses **Django Channels** with **Redis** as the channel layer for real-time message delivery.

## Run backend with WebSocket support

1. **Install Redis** (required for channel layer):
   - Windows: [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL
   - Mac: `brew install redis` then `brew services start redis`
   - Linux: `sudo apt install redis-server` (or equivalent)

2. **Start Redis** (if not a service):
   ```bash
   redis-server
   ```

3. **Run Django with ASGI** (so WebSockets work):
   ```bash
   cd backend
   python manage.py runserver
   ```
   Django's `runserver` supports ASGI and WebSockets when `channels` is installed.  
   For production, use an ASGI server such as **Daphne** or **Uvicorn**.

## Flow

- **REST API** (unchanged): Send message via `POST /api/messages/`; permission logic is unchanged.
- **WebSocket**: Connect to `ws://<host>/ws/chat/<other_user_id>/?token=<jwt>`.
- Only **allowed chat partners** (same logic as REST) can join a conversation room.
- When a message is **saved** (REST), the backend **broadcasts** it to the room; all participants receive it in real time.
- Frontend keeps **polling as fallback** (slower interval when WebSocket is connected).

## Optional: In-memory layer (no Redis)

For local dev without Redis, you can switch to in-memory layer in `core/settings.py`:

```python
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}
```

Note: In-memory does not work across multiple processes/workers.
