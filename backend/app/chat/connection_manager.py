"""
In-process WebSocket connection registry, keyed by chat thread.
Sufficient for a single-instance deployment; for horizontal scaling,
swap the in-memory dict for a Redis pub/sub fan-out (broker already
provisioned via REDIS_URL) without changing the router's call sites.
"""
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, thread_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[thread_id].add(websocket)

    def disconnect(self, thread_id: str, websocket: WebSocket) -> None:
        self._connections[thread_id].discard(websocket)
        if not self._connections[thread_id]:
            self._connections.pop(thread_id, None)

    async def broadcast(self, thread_id: str, payload: dict) -> None:
        dead = []
        for ws in self._connections.get(thread_id, set()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(thread_id, ws)


manager = ChatConnectionManager()
