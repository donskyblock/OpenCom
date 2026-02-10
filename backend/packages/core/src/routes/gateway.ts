import { WebSocketServer } from "ws";
import type { FastifyInstance } from "fastify";
import { GatewayEnvelope, CoreIdentify } from "@ods/shared/dist/events.js";

type Conn = {
  ws: any;
  userId: string;
  deviceId?: string;
  seq: number;
};

export function attachCoreGateway(app: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });

  const byDevice = new Map<string, Conn>(); // deviceId -> Conn

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
        const d = msg.d as CoreIdentify;
        // Verify access token via fastify-jwt
        try {
          const decoded: any = await (app as any).jwt.verify(d.accessToken);
          const userId = decoded.sub as string;
          const deviceId = d.deviceId;

          conn = { ws, userId, deviceId, seq: 0 };
          if (deviceId) byDevice.set(deviceId, conn);

          send(ws, { op: "READY", d: { user: { id: userId, username: "unknown" } } });
        } catch {
          send(ws, { op: "ERROR", d: { error: "INVALID_TOKEN" } });
          ws.close();
        }
      }

      if (msg.op === "HEARTBEAT") {
        send(ws, { op: "HEARTBEAT_ACK" });
      }
    });

    ws.on("close", () => {
      if (conn?.deviceId) byDevice.delete(conn.deviceId);
    });
  });

  // Used by DM route to push to a specific recipient device
  function broadcastDM(recipientDeviceId: string, envelope: any) {
    const c = byDevice.get(recipientDeviceId);
    if (!c) return;
    c.seq += 1;
    send(c.ws, { op: "DISPATCH", t: "DM_MESSAGE_CREATE", s: c.seq, d: { envelope } });
  }

  return { broadcastDM };
}
