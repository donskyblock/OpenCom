export type GatewayOpcode = "HELLO" | "IDENTIFY" | "READY" | "DISPATCH" | "HEARTBEAT" | "HEARTBEAT_ACK" | "ERROR";

export type GatewayEnvelope<T = unknown> = {
  op: GatewayOpcode;
  d?: T;
  s?: number;       // sequence
  t?: string;       // event type for DISPATCH
};

export type CoreIdentify = { accessToken: string; deviceId?: string };
export type NodeIdentify = { membershipToken: string };

export type ReadyPayload = {
  user: { id: string; username: string };
};

export type DMEnvelope = {
  threadId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  header: Record<string, unknown>;
  ciphertext: string; // base64/string - server never inspects
  sentAt: string;
  messageId: string;
};

export type DMMessageCreate = { envelope: DMEnvelope };

export type NodeMessageCreate = {
  channelId: string;
  message: { id: string; authorId: string; content: string; createdAt: string };
};

export type TypingStart = { channelId?: string; threadId?: string; userId: string };
