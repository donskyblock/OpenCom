export function ModerationSettingsSection({
  canModerateMembers,
  resolvedMemberList,
  me,
  moderationMemberId,
  setModerationMemberId,
  canBanMembers,
  moderationBanReason,
  setModerationBanReason,
  canKickMembers,
  moderationBusy,
  kickMember,
  banMember,
  moderationUnbanUserId,
  setModerationUnbanUserId,
  unbanMember,
}) {
  if (!canModerateMembers) return null;

  return (
    <>
      <section className="card">
        <h4>Member moderation</h4>
        <p className="hint">
          Kick removes a member from this guild. Ban removes and blocks rejoin
          until unbanned.
        </p>
        <select
          value={moderationMemberId}
          onChange={(event) => setModerationMemberId(event.target.value)}
        >
          <option value="">Select member</option>
          {resolvedMemberList
            .filter((member) => member.id !== me?.id)
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.username}
              </option>
            ))}
        </select>
        {canBanMembers && (
          <input
            placeholder="Ban reason (optional)"
            value={moderationBanReason}
            onChange={(event) => setModerationBanReason(event.target.value)}
          />
        )}
        <div className="row-actions">
          {canKickMembers && (
            <button
              disabled={!moderationMemberId || moderationBusy}
              onClick={() => kickMember(moderationMemberId)}
            >
              Kick Member
            </button>
          )}
          {canBanMembers && (
            <button
              className="danger"
              disabled={!moderationMemberId || moderationBusy}
              onClick={() => banMember(moderationMemberId, moderationBanReason)}
            >
              Ban Member
            </button>
          )}
        </div>
      </section>

      {canBanMembers && (
        <section className="card">
          <h4>Unban user</h4>
          <p className="hint">Paste a user ID and remove their ban record.</p>
          <input
            placeholder="User ID to unban"
            value={moderationUnbanUserId}
            onChange={(event) => setModerationUnbanUserId(event.target.value)}
          />
          <button
            disabled={!moderationUnbanUserId.trim() || moderationBusy}
            onClick={() => unbanMember(moderationUnbanUserId.trim())}
          >
            Unban User
          </button>
        </section>
      )}
    </>
  );
}
