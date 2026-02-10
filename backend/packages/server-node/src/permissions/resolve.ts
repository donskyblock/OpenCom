import { q } from "../db.js";
import { Perm, has } from "./bits.js";

type Overwrite = { target_type: "role" | "member"; target_id: string; allow: string; deny: string };
type RoleRow = { id: string; permissions: string; is_everyone: number };

function toBig(x: any): bigint {
  // mysql2 returns BIGINT as string by default
  return BigInt(x);
}

export async function resolveChannelPermissions(params: {
  guildId: string;
  channelId: string;
  userId: string;
}): Promise<bigint> {
  const { guildId, channelId, userId } = params;

  // Roles in guild (including @everyone)
  const roles = await q<RoleRow>(
    `SELECT r.id, r.permissions, r.is_everyone
     FROM roles r
     WHERE r.guild_id=:guildId`,
    { guildId }
  );

  const everyone = roles.find(r => r.is_everyone === 1);
  const everyonePerms = everyone ? toBig(everyone.permissions) : 0n;

  // Member role ids
  const memberRoles = await q<{ role_id: string }>(
    `SELECT role_id FROM member_roles WHERE guild_id=:guildId AND user_id=:userId`,
    { guildId, userId }
  );

  let perms = everyonePerms;
  for (const mr of memberRoles) {
    const role = roles.find(r => r.id === mr.role_id);
    if (role) perms |= toBig(role.permissions);
  }

  // Admin bypass
  if (has(perms, Perm.ADMINISTRATOR)) {
    // grant "all" = for MVP just set all known bits; you can decide a full mask later
    let all = 0n;
    for (const v of Object.values(Perm)) all |= v as unknown as bigint;
    return all;
  }

  // Channel overwrites
  const overwrites = await q<Overwrite>(
    `SELECT target_type, target_id, allow, deny
     FROM channel_overwrites
     WHERE channel_id=:channelId`,
    { channelId }
  );

  const apply = (base: bigint, allow: bigint, deny: bigint) => (base & ~deny) | allow;

  // 1) @everyone overwrite
  if (everyone) {
    const ov = overwrites.find(o => o.target_type === "role" && o.target_id === everyone.id);
    if (ov) perms = apply(perms, toBig(ov.allow), toBig(ov.deny));
  }

  // 2) role overwrites: combine allow/deny across all member roles
  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const mr of memberRoles) {
    const ov = overwrites.find(o => o.target_type === "role" && o.target_id === mr.role_id);
    if (!ov) continue;
    roleAllow |= toBig(ov.allow);
    roleDeny |= toBig(ov.deny);
  }
  perms = apply(perms, roleAllow, roleDeny);

  // 3) member overwrite
  const mov = overwrites.find(o => o.target_type === "member" && o.target_id === userId);
  if (mov) perms = apply(perms, toBig(mov.allow), toBig(mov.deny));

  return perms;
}
