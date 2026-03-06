function resolveRoleColor(role) {
  if (role?.color == null || role.color === "") return "#99aab5";
  if (typeof role.color === "number") {
    return `#${Number(role.color).toString(16).padStart(6, "0")}`;
  }
  return role.color;
}

export function RolesSettingsSection({
  canManageServer,
  newRoleName,
  setNewRoleName,
  createRole,
  guildState,
  updateRole,
  selectedMemberId,
  setSelectedMemberId,
  resolvedMemberList,
  selectedRoleId,
  setSelectedRoleId,
  assignRoleToMember,
}) {
  if (!canManageServer) return null;

  return (
    <>
      <section className="card">
        <h4>Create Role</h4>
        <input
          placeholder="Role name"
          value={newRoleName}
          onChange={(event) => setNewRoleName(event.target.value)}
        />
        <button onClick={createRole}>Create Role</button>
      </section>

      <section className="card">
        <h4>Edit Roles (colour & hierarchy)</h4>
        <p className="hint">
          Higher position = higher in the list. Colours show in member list and
          chat.
        </p>
        <ul className="role-edit-list">
          {(guildState?.roles || [])
            .filter((role) => !role.is_everyone)
            .sort((left, right) => (right.position ?? 0) - (left.position ?? 0))
            .map((role) => {
              const hexColor = resolveRoleColor(role);
              return (
                <li key={role.id} className="role-edit-row">
                  <span className="role-edit-name" style={{ color: hexColor }}>
                    {role.name}
                  </span>
                  <input
                    type="color"
                    value={hexColor}
                    onChange={(event) =>
                      updateRole(role.id, { color: event.target.value })
                    }
                    title="Role colour"
                  />
                  <label>
                    Position{" "}
                    <input
                      type="number"
                      min={0}
                      value={role.position ?? 0}
                      onChange={(event) =>
                        updateRole(role.id, {
                          position: parseInt(event.target.value, 10) || 0,
                        })
                      }
                    />
                  </label>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="card">
        <h4>Assign Role</h4>
        <select
          value={selectedMemberId}
          onChange={(event) => setSelectedMemberId(event.target.value)}
        >
          <option value="">Select member</option>
          {resolvedMemberList.map((member) => (
            <option key={member.id} value={member.id}>
              {member.username}
            </option>
          ))}
        </select>
        <select
          value={selectedRoleId}
          onChange={(event) => setSelectedRoleId(event.target.value)}
        >
          <option value="">Select role</option>
          {(guildState?.roles || [])
            .filter((role) => !role.is_everyone)
            .map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
        </select>
        <button onClick={assignRoleToMember}>Assign Role</button>
      </section>
    </>
  );
}
