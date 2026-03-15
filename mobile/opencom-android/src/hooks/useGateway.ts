import { useCallback, useEffect, useRef } from "react";
import type {
  ChannelMessage,
  DmMessageApi,
  GatewayEvent,
  NodeGatewayEvent,
} from "../types";

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
    parsed.pathname = "/gateway";
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
  guildId?: string | null;
  channelId?: string | null;
  onEvent: NodeGatewayEventHandler;
  enabled?: boolean;
};

function isDispatchMessage(msg: { op: unknown; t?: string }) {
  return msg.op === "DISPATCH" || msg.op === 0;
}

function isHelloMessage(msg: { op: unknown }) {
  return msg.op === "HELLO" || msg.op === 10;
}

function normalizeChannelMessage(raw: any): ChannelMessage {
  const attachments = Array.isArray(raw?.attachments)
    ? raw.attachments.map((attachment: any) => ({
        id: String(attachment?.id ?? ""),
        filename:
          attachment?.filename ??
          attachment?.fileName ??
          attachment?.name ??
          "attachment",
        fileName:
          attachment?.fileName ??
          attachment?.filename ??
          attachment?.name ??
          "attachment",
        url: String(attachment?.url ?? ""),
        mimeType: attachment?.mimeType ?? attachment?.contentType ?? null,
        contentType: attachment?.contentType ?? attachment?.mimeType ?? null,
        size: attachment?.size ?? attachment?.sizeBytes ?? null,
        sizeBytes: attachment?.sizeBytes ?? attachment?.size ?? null,
      }))
    : [];

  return {
    id: String(raw?.id ?? ""),
    author_id: String(raw?.author_id ?? raw?.authorId ?? ""),
    username: raw?.username ?? raw?.authorName ?? undefined,
    pfp_url: raw?.pfp_url ?? raw?.author_avatar_url ?? raw?.authorAvatarUrl ?? null,
    content: String(raw?.content ?? ""),
    created_at: String(raw?.created_at ?? raw?.createdAt ?? new Date().toISOString()),
    edited: Boolean(raw?.edited),
    attachments,
    reply_to_id: raw?.reply_to_id ?? raw?.replyToId ?? null,
    reply_to_content: raw?.reply_to_content ?? raw?.replyToContent ?? null,
    reply_to_author: raw?.reply_to_author ?? raw?.replyToAuthor ?? null,
  };
}

function normalizeDmMessage(raw: any): DmMessageApi {
  const attachments = Array.isArray(raw?.attachments)
    ? raw.attachments.map((attachment: any) => ({
        id: String(attachment?.id ?? ""),
        filename:
          attachment?.filename ??
          attachment?.fileName ??
          attachment?.name ??
          "attachment",
        fileName:
          attachment?.fileName ??
          attachment?.filename ??
          attachment?.name ??
          "attachment",
        url: String(attachment?.url ?? ""),
        mimeType: attachment?.mimeType ?? attachment?.contentType ?? null,
        contentType: attachment?.contentType ?? attachment?.mimeType ?? null,
        size: attachment?.size ?? attachment?.sizeBytes ?? null,
        sizeBytes: attachment?.sizeBytes ?? attachment?.size ?? null,
      }))
    : [];

  return {
    id: String(raw?.id ?? ""),
    authorId: String(raw?.authorId ?? raw?.author_id ?? ""),
    author: String(raw?.author ?? raw?.username ?? raw?.authorName ?? ""),
    pfp_url: raw?.pfp_url ?? raw?.pfpUrl ?? null,
    content: String(raw?.content ?? ""),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? new Date().toISOString()),
    edited: Boolean(raw?.edited),
    attachments,
    replyToId: raw?.replyToId ?? raw?.reply_to_id ?? null,
    replyToContent: raw?.replyToContent ?? raw?.reply_to_content ?? null,
    replyToAuthor: raw?.replyToAuthor ?? raw?.reply_to_author ?? null,
  };
}

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
      ws.send(JSON.stringify({ op: "IDENTIFY", d: { accessToken } }));
    };

    ws.onmessage = (e) => {
      let msg: { op: unknown; t?: string; d?: any };
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "{}");
      } catch {
        return;
      }

      if (isHelloMessage(msg)) {
        const interval: number =
          msg.d?.heartbeat_interval ?? msg.d?.heartbeatInterval ?? 30_000;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: "HEARTBEAT" }));
          }
        }, interval);
        attemptRef.current = 0;
        return;
      }

      if (isDispatchMessage(msg) && msg.t) {
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
                message: normalizeDmMessage(d.message),
              });
            }
            break;
          case "SOCIAL_DM_MESSAGE_CREATE":
            if (d.threadId && d.message) {
              onEventRef.current({
                type: "DM_NEW_MESSAGE",
                threadId: d.threadId,
                message: normalizeDmMessage(d.message),
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
          case "SOCIAL_DM_MESSAGE_DELETE":
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
          case "PRIVATE_CALL_CREATE":
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
          case "PRIVATE_CALL_ENDED":
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
  guildId,
  channelId,
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
      ws.send(JSON.stringify({ op: "IDENTIFY", d: { membershipToken } }));
    };

    ws.onmessage = (e) => {
      let msg: { op: unknown; t?: string; d?: any };
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "{}");
      } catch {
        return;
      }

      if (isHelloMessage(msg)) {
        const interval: number =
          msg.d?.heartbeat_interval ?? msg.d?.heartbeatInterval ?? 30_000;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: "HEARTBEAT" }));
          }
        }, interval);
        attemptRef.current = 0;
        return;
      }

      if (msg.op === "READY") {
        if (guildId) {
          ws.send(
            JSON.stringify({
              op: "DISPATCH",
              t: "SUBSCRIBE_GUILD",
              d: { guildId },
            }),
          );
        }
        if (channelId) {
          ws.send(
            JSON.stringify({
              op: "DISPATCH",
              t: "SUBSCRIBE_CHANNEL",
              d: { channelId },
            }),
          );
        }
        return;
      }

      if (isDispatchMessage(msg) && msg.t) {
        const d = msg.d ?? {};
        switch (msg.t) {
          case "MESSAGE_CREATE":
            if (d.channelId && d.message) {
              onEventRef.current({
                type: "MESSAGE_CREATE",
                channelId: d.channelId,
                message: normalizeChannelMessage(d.message),
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
              username: d.username ?? "",
              pfp_url: d.pfp_url ?? null,
            });
            break;
          case "VOICE_STATE_REMOVE":
            onEventRef.current({
              type: "VOICE_STATE_UPDATE",
              userId: d.userId ?? "",
              guildId: d.guildId ?? "",
              channelId: null,
              muted: false,
              deafened: false,
              username: d.username ?? "",
              pfp_url: d.pfp_url ?? null,
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
  }, [wsUrl, membershipToken, guildId, channelId, cleanup, scheduleReconnect]);

  useEffect(() => {
    disposedRef.current = false;
    if (enabled && wsUrl && membershipToken) {
      connectNode();
    }
    return () => {
      disposedRef.current = true;
      cleanup();
    };
  }, [enabled, wsUrl, membershipToken, guildId, channelId]); // eslint-disable-line
}
