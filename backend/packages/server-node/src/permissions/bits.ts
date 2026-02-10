// Keep this compatible with Discord-style BIGINT bitsets.
// You can expand this list over time.
export const Perm = {
  VIEW_CHANNEL: 1n << 0n,
  SEND_MESSAGES: 1n << 1n,
  MANAGE_CHANNELS: 1n << 2n,
  MANAGE_ROLES: 1n << 3n,
  KICK_MEMBERS: 1n << 4n,
  BAN_MEMBERS: 1n << 5n,
  MUTE_MEMBERS: 1n << 6n,
  DEAFEN_MEMBERS: 1n << 7n,
  MOVE_MEMBERS: 1n << 8n,
  CONNECT: 1n << 9n,        // voice
  SPEAK: 1n << 10n,         // voice
  ADMINISTRATOR: 1n << 60n,  // override everything
  ATTACH_FILES: 1n << 11n
} as const;

export type PermBit = bigint;

export function has(all: bigint, bit: bigint) {
  return (all & bit) === bit;
}
