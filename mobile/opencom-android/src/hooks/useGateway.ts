import { useCallback, useEffect, useRef } from "react";
import type { GatewayEvent, NodeGatewayEvent } from "../types";

// ─── URL helpers ─────────────────────────────────────────────────────────────

export function httpToCoreGatewayWs(coreApiUrl: string): string {
  try {
    const parsed = new URL(coreApiUrl.replace(/\/$/, ""));
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    parsed.pathname = "/v1/gateway/connect";
    return parsed.toString();
  } catch {
    return "wss://api.opencom.online/v1/gateway/connect";
  }
}

export function httpToNodeGatewayWs(serverBaseUrl: string): string {
  try {
    const parsed = new URL(serverBaseUrl.replace(/\/$/, ""));
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    parsed.pathname = "/v1/gateway/ws";
    return parsed.toString();
  } catch {
    return "";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type GatewayEventHandler = (event: GatewayEvent) => void;
type NodeGatewayEventHandler = (event: NodeGatewayEvent) => void;

type UseCoreGatewayOptions = {
  wsUrl: string;
  accessToken: string | null;
  onEvent: GatewayEventHandler;
  enabled?: boolean;
};

type UseNodeGatewayOptions = {
  wsUrl: string;
  membershipToken: string | null;
  onEvent: NodeGatewayEventHandler;
  enabled?: boolean;
};

// ─── Core gateway hook ───────────────────────────────────────────────────────
// Connects to the main platform gateway for real-time DMs, presence and calls.

export function useCoreGateway({
  wsUrl,
  accessToken,
  onEvent,
  enabled = true,
}: UseCoreGatewayOptions): void {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const disposedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (disposedRef.current) return;
    const delay = Math.min(1000 * 2 ** Math.min(attemptRef.current, 6), 30_000);
    attemptRef.current += 1;
    reconnectRef.current = setTimeout(() => connect(), delay); // eslint-disable-line
  }, []); // eslint-disable-line

  const connect = useCallback(() => {
    if (disposedRef.current || !wsUrl || !accessToken) return;
    cleanup();

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Identify
      ws.send(JSON.stringify({ op: 1, d: { token: accessToken } }));
    };

    ws.onmessage = (e) => {
      let msg: { op: number; t?: string; d?: any };
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "{}");
      } catch {
        return;
      }

      if (msg.op === 10) {
        // HELLO – start heartbeat
        const interval: number = msg.d?.heartbeatInterval ?? 30_000;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 2 }));
          }
        }, interval);
        attemptRef.current = 0;
        return;
      }

      if (msg.op === 0 && msg.t) {
        const d = msg.d ?? {};
        switch (msg.t) {
          case "SELF_STATUS":
            onEventRef.current({
              type: "SELF_STATUS",
              status: d.status ?? "online",
              customStatus: d.customStatus ?? null,
            });
            break;
          case "PRESENCE_UPDATE":
            onEventRef.current({
              type: "PRESENCE_UPDATE",
              userId: d.userId ?? "",
              status: d.status ?? "offline",
              customStatus: d.customStatus ?? null,
            });
            break;
          case "DM_NEW_MESSAGE":
          case "DM_MESSAGE":
            if (d.threadId && d.message) {
              onEventRef.current({
                type: "DM_NEW_MESSAGE",
                threadId: d.threadId,
                message: d.message,
              });
            }
            break;
          case "DM_MESSAGE_DELETED":
            if (d.threadId && d.messageId) {
              onEventRef.current({
                type: "DM_MESSAGE_DELETED",
                threadId: d.threadId,
                messageId: d.messageId,
              });
            }
            break;
          case "DM_READ":
            if (d.threadId) {
              onEventRef.current({ type: "DM_READ", threadId: d.threadId });
            }
            break;
          case "CALL_INCOMING":
            onEventRef.current({
              type: "CALL_INCOMING",
              callId: d.callId ?? "",
              callerId: d.callerId ?? "",
              callerName: d.callerName ?? "Unknown",
              callerPfp: d.callerPfp ?? null,
              channelId: d.channelId,
              guildId: d.guildId,
              nodeBaseUrl: d.nodeBaseUrl,
            });
            break;
          case "CALL_ENDED":
            if (d.callId) {
              onEventRef.current({ type: "CALL_ENDED", callId: d.callId });
            }
            break;
          case "FRIEND_REQUEST":
            onEventRef.current({
              type: "FRIEND_REQUEST",
              requestId: d.requestId ?? "",
              userId: d.userId ?? "",
              username: d.username ?? "",
            });
            break;
          case "FRIEND_ACCEPTED":
            onEventRef.current({
              type: "FRIEND_ACCEPTED",
              friendId: d.friendId ?? "",
              username: d.username ?? "",
            });
            break;
          default:
            break;
        }
      }
    };

    ws.onerror = () => {
      // Will trigger onclose as well
    };

    ws.onclose = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      wsRef.current = null;
      scheduleReconnect();
    };
  }, [wsUrl, accessToken, cleanup, scheduleReconnect]);

  useEffect(() => {
    disposedRef.current = false;
    if (enabled && wsUrl && accessToken) {
      connect();
    }
    return () => {
      disposedRef.current = true;
      cleanup();
    };
  }, [enabled, wsUrl, accessToken]); // eslint-disable-line
}

// ─── Node gateway hook ───────────────────────────────────────────────────────
// Connects to a specific server node gateway for channel messages and voice.

export function useNodeGateway({
  wsUrl,
  membershipToken,
  onEvent,
  enabled = true,
}: UseNodeGatewayOptions): void {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const disposedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (disposedRef.current) return;
    const delay = Math.min(1000 * 2 ** Math.min(attemptRef.current, 6), 30_000);
    attemptRef.current += 1;
    reconnectRef.current = setTimeout(() => connectNode(), delay); // eslint-disable-line
  }, []); // eslint-disable-line

  const connectNode = useCallback(() => {
    if (disposedRef.current || !wsUrl || !membershipToken) return;
    cleanup();

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Identify with membership token (op 0 for node gateway)
      ws.send(JSON.stringify({ op: 0, d: { membershipToken } }));
    };

    ws.onmessage = (e) => {
      let msg: { op: number; t?: string; d?: any };
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "{}");
      } catch {
        return;
      }

      if (msg.op === 10) {
        // HELLO
        const interval: number = msg.d?.heartbeatInterval ?? 30_000;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 2 }));
          }
        }, interval);
        attemptRef.current = 0;
        return;
      }

      if (msg.op === 0 && msg.t) {
        const d = msg.d ?? {};
        switch (msg.t) {
          case "MESSAGE_CREATE":
            if (d.channelId && d.message) {
              onEventRef.current({
                type: "MESSAGE_CREATE",
                channelId: d.channelId,
                message: d.message,
              });
            }
            break;
          case "MESSAGE_UPDATE":
            if (d.channelId && d.messageId) {
              onEventRef.current({
                type: "MESSAGE_UPDATE",
                channelId: d.channelId,
                messageId: d.messageId,
                content: d.content ?? "",
                edited: true,
              });
            }
            break;
          case "MESSAGE_DELETE":
            if (d.channelId && d.messageId) {
              onEventRef.current({
                type: "MESSAGE_DELETE",
                channelId: d.channelId,
                messageId: d.messageId,
              });
            }
            break;
          case "VOICE_STATE_UPDATE":
            onEventRef.current({
              type: "VOICE_STATE_UPDATE",
              userId: d.userId ?? "",
              guildId: d.guildId ?? "",
              channelId: d.channelId ?? null,
              muted: d.muted ?? false,
              deafened: d.deafened ?? false,
            });
            break;
          case "VOICE_JOIN":
            onEventRef.current({
              type: "VOICE_JOIN",
              userId: d.userId ?? "",
              username: d.username ?? "",
              guildId: d.guildId ?? "",
              channelId: d.channelId ?? "",
            });
            break;
          case "VOICE_LEAVE":
            onEventRef.current({
              type: "VOICE_LEAVE",
              userId: d.userId ?? "",
              guildId: d.guildId ?? "",
              channelId: d.channelId ?? "",
            });
            break;
          case "VOICE_SPEAKING":
            onEventRef.current({
              type: "VOICE_SPEAKING",
              userId: d.userId ?? "",
              guildId: d.guildId ?? "",
              channelId: d.channelId ?? "",
              speaking: d.speaking ?? false,
            });
            break;
          default:
            break;
        }
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      wsRef.current = null;
      scheduleReconnect();
    };
  }, [wsUrl, membershipToken, cleanup, scheduleReconnect]);

  useEffect(() => {
    disposedRef.current = false;
    if (enabled && wsUrl && membershipToken) {
      connectNode();
    }
    return () => {
      disposedRef.current = true;
      cleanup();
    };
  }, [enabled, wsUrl, membershipToken]); // eslint-disable-line
}
