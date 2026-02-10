import { WebSocketServer } from "ws";
import type { FastifyInstance } from "fastify";
import { GatewayEnvelope, NodeIdentify } from "@ods/shared/dist/events.js";
import { verifyMembershipToken } from "./auth/verifyMembership.js";

type Conn = { ws: any; userId: string; serverId: string; seq: number; channels: Set<string> };

export function attachNodeGateway(app: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });
  const conns = new Set<Conn>();

  function send(ws: any, msg: GatewayEnvelope) {
    ws.send(JSON.stringify(msg));
  }

  app.server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/gateway")) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    }
  });

  wss.on("connection", (ws) => {
    let conn: Conn | null = null;
    send(ws, { op: "HELLO", d: { heartbeat_interval: 25000 } });

    ws.on("message", async (raw: Buffer) => {
      let msg: GatewayEnvelope;
      try { msg = JSON.parse(raw.toString("utf8")); } catch { return; }

      if (msg.op === "IDENTIFY") {
        const d = msg.d as NodeIdentify;
        try {
          const claims = await verifyMembershipToken(d.membershipToken);
          conn = { ws, userId: claims.sub, serverId: claims.server_id, seq: 0, channels: new Set() };
          conns.add(conn);
          send(ws, { op: "READY", d: { user: { id: conn.userId, username: "unknown" } } });
        } catch (e) {
          send(ws, { op: "ERROR", d: { error: "INVALID_MEMBERSHIP" } });
          ws.close();
        }
      }

      if (msg.op === "HEARTBEAT") send(ws, { op: "HEARTBEAT_ACK" });

      if (msg.op === "DISPATCH" && msg.t === "SUBSCRIBE_CHANNEL") {
        if (!conn) return;
        const channelId = (msg.d as any)?.channelId;
        if (typeof channelId === "string") conn.channels.add(channelId);
      }
    });

    ws.on("close", () => {
      if (conn) conns.delete(conn);
    });
  });

  function broadcastToChannel(channelId: string, payload: any) {
    for (const c of conns) {
      if (!c.channels.has(channelId)) continue;
      c.seq += 1;
      send(c.ws, { op: "DISPATCH", t: "MESSAGE_CREATE", s: c.seq, d: payload });
    }
  }

  return { broadcastToChannel };
}
