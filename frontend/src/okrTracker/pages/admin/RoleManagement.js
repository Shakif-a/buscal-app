import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import adminService from "../../features/admin/adminService";
import "./RoleManagement.css";

function canManageAdmin(user) {
  if (!user) {
    return false;
  }

  if (user.roles && user.roles.includes("admin")) {
    return true;
  }

  return user.exec === "yes";
}

function getErrorMessage(error) {
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }

  return error.message || "Something went wrong";
}

function getUserName(user) {
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.email;
}

function makeRoleState(rows, permissionList) {
  const result = {};

  for (const savedRole of rows) {
    const roleName = savedRole.role;
    const savedPermissions = savedRole.permissions;
    result[roleName] = {};

    for (let j = 0; j < permissionList.length; j++) {
      const permission = permissionList[j];
      result[roleName][permission] = savedPermissions.includes(permission);
    }
  }

  return result;
}

function RoleManagement() {
  const { user } = useSelector((state) => state.auth);
  const [roles, setRoles] = useState(null);
  const [roleRows, setRoleRows] = useState([]);
  const [permissionList, setPermissionList] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const [people, setPeople] = useState([]);
  const [draftMembers, setDraftMembers] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [expandedRole, setExpandedRole] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savedRole, setSavedRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openRoleMenu, setOpenRoleMenu] = useState(null);
  const [roleModalAction, setRoleModalAction] = useState("");
  const [roleModalRole, setRoleModalRole] = useState("");
  const [roleModalName, setRoleModalName] = useState("");
  const allowed = canManageAdmin(user);

  useEffect(() => {
    async function loadPermissions() {
      if (!allowed) {
        setIsLoading(false);
        return;
      }

      try {
        await loadRoles();
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    loadPermissions();
  }, [allowed, user]);

  async function loadRoles() {
    const data = await adminService.getRoles(user.token);
    setRoleRows(data.roles);
    setPermissionList(data.permissionNames);
    setRoles(makeRoleState(data.roles, data.permissionNames));
    setCanEdit(data.canManageRoles);
    setCanAssign(data.canManageUsers);
    if (data.canManageUsers) {
      const users = await adminService.getUsers(user.token);
      setPeople(users);
      return users;
    }
    return [];
  }

  // Custom roles are stored on each user as okrRole. Admins and executives
  // always use the Admin role, so they cannot be assigned here.
  const assignablePeople = people.filter((person) => !canManageAdmin(person));

  function getMemberIds(roleName, list = people) {
    return list
      .filter(
        (person) => person.okrRole === roleName && !canManageAdmin(person),
      )
      .map((person) => person._id);
  }

  function openRoleModal(action, role = "") {
    if (isSaving || !canEdit) return;

    setRoleModalAction(action);
    setRoleModalRole(role);
    setRoleModalName(action === "rename" ? role : "");
    setOpenRoleMenu(null);
  }

  function closeRoleModal() {
    if (isSaving) return;

    setRoleModalAction("");
    setRoleModalRole("");
    setRoleModalName("");
  }

  async function changeRole() {
    if (isSaving || !canEdit || !roleModalAction) return;

    const action = roleModalAction;
    const role = roleModalRole;
    const name = roleModalName.trim();

    if ((action === "create" || action === "rename") && !name) {
      return;
    }

    setIsSaving(true);

    try {
      if (action === "create") {
        await adminService.createRole(name, user.token);
      }

      if (action === "rename") {
        await adminService.renameRole(role, name, user.token);
      }

      if (action === "delete") {
        await adminService.deleteRole(role, user.token);
      }

      await loadRoles();

      setStatusMessage("Role changes saved.");
      setErrorMessage("");

      setRoleModalAction("");
      setRoleModalRole("");
      setRoleModalName("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleMember(userId) {
    if (draftMembers.includes(userId)) {
      setDraftMembers(draftMembers.filter((id) => id !== userId));
    } else {
      setDraftMembers([...draftMembers, userId]);
    }
  }

  async function saveMembers(roleName) {
    if (isSaving || !canAssign) return;

    const currentMembers = getMemberIds(roleName);
    const added = draftMembers.filter((id) => !currentMembers.includes(id));
    const removed = currentMembers.filter((id) => !draftMembers.includes(id));

    setIsSaving(true);
    try {
      for (const userId of added) {
        await adminService.assignRole(userId, roleName, user.token);
      }
      for (const userId of removed) {
        await adminService.assignRole(userId, null, user.token);
      }
      setStatusMessage(`Members of ${roleName} saved.`);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatusMessage("");
    } finally {
      // Reload either way so a partial failure shows what was actually saved.
      try {
        const users = await loadRoles();
        setDraftMembers(getMemberIds(roleName, users));
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
      setIsSaving(false);
    }
  }

  function toggleExpand(roleName) {
    if (expandedRole === roleName) {
      setExpandedRole(null);
    } else {
      setExpandedRole(roleName);
      setDraftMembers(getMemberIds(roleName));
    }
  }

  function isSystemRole(roleName) {
    const row = roleRows.find((item) => item.role === roleName);
    return !row || row.system;
  }

  function togglePermission(roleName, permission) {
    setRoles((previous) => ({
      ...previous,
      [roleName]: {
        ...previous[roleName],
        [permission]: !previous[roleName][permission],
      },
    }));
  }
  function resetRole(roleName) {
    setRoles((previous) => {
      const row = roleRows.find((row) => row.role === roleName);
      const defaults = makeRoleState(
        [{ role: roleName, permissions: row.defaultPermissions }],
        permissionList,
      );
      return { ...previous, [roleName]: defaults[roleName] };
    });
  }

  async function saveRole(roleName) {
    if (!roles || isSaving || !canEdit) {
      return;
    }

    setIsSaving(true);
    const permissions = [];

    for (let i = 0; i < permissionList.length; i++) {
      const permission = permissionList[i];

      if (roles[roleName][permission]) {
        permissions.push(permission);
      }
    }

    try {
      const saved = await adminService.updatePermissions(
        roleName,
        permissions,
        user.token,
      );

      const savedRoleState = makeRoleState([saved], permissionList)[roleName];

      setRoles((previous) => ({
        ...previous,
        [roleName]: makeRoleState([saved], permissionList)[roleName],
      }));
      if (roleName === "Admin") {
        setCanEdit(saved.permissions.includes("Manage Roles"));
        setCanAssign(saved.permissions.includes("Manage Users"));
      }
      setSavedRole(roleName);
      setShowSavePopup(true);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const visibleRoles = roleRows
    .map((row) => row.role)
    .filter((name) => name.toLowerCase().includes(searchText.toLowerCase()));

  if (!allowed) {
    return (
      <div className="role-management">
        <div role="alert" className="role-status role-error">
          Admin or executive access is required.
        </div>
      </div>
    );
  }

  return (
    <div className="role-management">
      <div className="role-header">
        <div className="role-header-title">
          <div className="role-header-title-inner">
            <img
              src="/images/okr/ArrowLogoLeft.png"
              alt="Arrow Logo L"
              className="logo"
            />
            <h1>Role Management</h1>
          </div>
          <img
            src="/images/okr/ArrowLogoRight.png"
            alt="Arrow Logo R"
            className="logo"
          />
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="role-status role-error">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div role="status" className="role-status">
          {statusMessage}
        </div>
      )}

      <div className="role-search-row">
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          aria-label="Search roles"
          disabled={isSaving}
          placeholder="Search role..."
          className="role-search-input"
        />
      </div>

      <div className="role-content-box">
        <div className="role-add-section">
          <button
            className="role-add-button"
            disabled={isLoading || isSaving || !canEdit}
            onClick={() => openRoleModal("create")}
          >
            (+) Add Role
          </button>
        </div>

        {isLoading && <div className="role-status">Loading permissions...</div>}

        {!isLoading && roles && (
          <>
            <div className="role-table-header">
              <div>ROLE</div>
              <div>MEMBERS</div>
              <div>ACTIONS</div>
            </div>

            {visibleRoles.length === 0 && (
              <div className="role-status">No roles found.</div>
            )}

            {visibleRoles.map((roleName) => (
              <div key={roleName}>
                <div className="role-table-row">
                  <div className="role-name">{roleName}</div>
                  <div className="role-member-count">
                    {isSystemRole(roleName) || !canAssign
                      ? "—"
                      : getMemberIds(roleName).length}
                  </div>
                  <div className="role-row-actions">
                    <button
                      onClick={() => toggleExpand(roleName)}
                      disabled={isSaving}
                      aria-expanded={expandedRole === roleName}
                      className="role-edit-button"
                    >
                      Edit
                      <span className="role-edit-arrow">
                        {expandedRole === roleName ? "▴" : "▾"}
                      </span>
                    </button>


                    {!isSystemRole(roleName) && (
                    <div className="role-more-menu-wrapper">
                      <button
                        type="button"
                        className="role-more-button"
                        aria-label={`More actions for ${roleName}`}
                        aria-expanded={openRoleMenu === roleName}
                        onClick={() =>
                          setOpenRoleMenu(
                            openRoleMenu === roleName ? null : roleName
                          )
                        }
                      >
                        <span></span>
                        <span></span>
                        <span></span>
                      </button>

                      {openRoleMenu === roleName && (
                        <div className="role-more-menu">
                          <button
                            type="button"
                            onClick={() => openRoleModal("rename", roleName)}
                          >
                            Rename
                          </button>

                          <button
                            type="button"
                            className="role-more-menu-delete"
                            onClick={() => openRoleModal("delete", roleName)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>

                {expandedRole === roleName && (
                  <div className="role-permissions-panel">
                    <div className="role-permissions-title">
                      Permissions for {roleName}
                    </div>

                    <div className="role-permissions-grid">
                      {permissionList.map((permission) => {
                        const isChecked = roles[roleName][permission];
                        const row = roleRows.find(
                          (item) => item.role === roleName,
                        );
                        const isLocked = (row.lockedPermissions || []).includes(
                          permission,
                        );
                        // A tick the user cannot remove is shown in grey.
                        const isFixed =
                          isLocked ||
                          !canEdit ||
                          !row.allowedPermissions.includes(permission);

                        return (
                          <label
                            key={permission}
                            className="role-permission-label"
                            title={
                              isLocked
                                ? `The ${roleName} role always keeps this permission`
                                : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              disabled={
                                isSaving ||
                                !canEdit ||
                                isLocked ||
                                !row.allowedPermissions.includes(permission)
                              }
                              checked={isChecked}
                              onChange={() =>
                                togglePermission(roleName, permission)
                              }
                              className="role-permission-checkbox-input"
                            />
                            <span
                              className={`role-permission-checkbox ${isChecked ? "checked" : ""
                                } ${isChecked && isFixed ? "fixed" : ""}`}
                            >
                              {isChecked ? "✓" : ""}
                            </span>
                            <span className="role-permission-name">
                              {permission}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="role-action-buttons">
                      <button
                        onClick={() => resetRole(roleName)}
                        disabled={isSaving || !canEdit}
                        className="role-reset-button"
                      >
                        Reset to defaults
                      </button>
                      <button
                        onClick={() => saveRole(roleName)}
                        disabled={isSaving || !canEdit}
                        className="role-save-button"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    {canAssign && isSystemRole(roleName) && (
                      <p className="role-member-help">
                        Users get the {roleName} role from their account and
                        company settings. Create a custom role to assign
                        members directly.
                      </p>
                    )}

                    {canAssign && !isSystemRole(roleName) && (
                      <>
                        <div className="role-permissions-title role-members-title">
                          Members of {roleName}
                        </div>

                        <div className="role-permissions-grid">
                          {assignablePeople.map((person) => {
                            const isChecked = draftMembers.includes(person._id);
                            const otherRole =
                              person.okrRole && person.okrRole !== roleName
                                ? person.okrRole
                                : "";

                            return (
                              <label
                                key={person._id}
                                className="role-permission-label"
                              >
                                <input
                                  type="checkbox"
                                  disabled={isSaving}
                                  checked={isChecked}
                                  onChange={() => toggleMember(person._id)}
                                  className="role-permission-checkbox-input"
                                />
                                <span
                                  className={`role-permission-checkbox ${isChecked ? "checked" : ""
                                    }`}
                                >
                                  {isChecked ? "✓" : ""}
                                </span>
                                <span className="role-permission-name">
                                  {getUserName(person)}
                                  {otherRole && (
                                    <span className="role-member-other">
                                      {" "}
                                      (currently {otherRole})
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="role-action-row">
                          <span className="role-member-help">
                            Each user has one OKR role. Selecting someone in
                            another role moves them here; unselecting returns
                            them to their account and company role.
                          </span>
                          <div className="role-action-buttons">
                            <button
                              onClick={() =>
                                setDraftMembers(getMemberIds(roleName))
                              }
                              disabled={isSaving}
                              className="role-reset-button"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveMembers(roleName)}
                              disabled={isSaving}
                              className="role-save-button"
                            >
                              {isSaving ? "Saving..." : "Save Members"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="role-reference-section">
        <div className="role-reference-box">
          <div className="role-reference-title">PERMISSION REFERENCE</div>
          <p>
            Admin pages are available only to administrators and executives.
          </p>
          <p>
            Objective creation follows the saved Create Objectives permission.
            Editing and deleting follow Edit Objectives, while objective owners
            can manage their own objectives. Group managers can manage
            objectives in their assigned groups using the Manager permissions.
          </p>
          <p>
            Key-result creation, approval, reports, and admin actions follow
            their named permissions. Admin-only settings cannot be delegated
            here. System roles (Admin, Manager, Employee) follow account and
            company settings and cannot be renamed, deleted, or assigned.
            Custom roles control OKR work and are assigned from the Members
            list under Edit. A role with members cannot be deleted. The Admin
            role always keeps Manage Roles and View Reports, so administrators
            can always reach this editor and the reports page. Reset to defaults changes the draft; select Save Changes to apply
            it.
          </p>
        </div>
      </div>

      {roleModalAction && (
        <div className="role-popup-overlay">
          <div
            className="role-popup"
            role="dialog"
            aria-modal="true"
          >
            <h2>
              {roleModalAction === "create" && "Add Role"}
              {roleModalAction === "rename" && "Rename Role"}
              {roleModalAction === "delete" && "Delete Role"}
            </h2>

            {roleModalAction === "delete" ? (
              <p>
                Are you sure you want to delete{" "}
                <strong>{roleModalRole}</strong>?
              </p>
            ) : (
              <>
                <p>
                  {roleModalAction === "create"
                    ? "Enter a name for the new role."
                    : "Enter the new role name."}
                </p>

                <input
                  type="text"
                  className="role-modal-input"
                  value={roleModalName}
                  onChange={(event) =>
                    setRoleModalName(event.target.value)
                  }
                  autoFocus
                />
              </>
            )}

            <div className="role-modal-actions">
              <button
                type="button"
                className="role-modal-cancel-button"
                onClick={closeRoleModal}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  roleModalAction === "delete"
                    ? "role-modal-delete-button"
                    : "role-modal-primary-button"
                }
                onClick={changeRole}
                disabled={
                  isSaving ||
                  ((roleModalAction === "create" ||
                    roleModalAction === "rename") &&
                    !roleModalName.trim())
                }
              >
                {isSaving
                  ? "Saving..."
                  : roleModalAction === "create"
                    ? "Add Role"
                    : roleModalAction === "rename"
                      ? "Rename"
                      : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSavePopup && (
        <div className="role-popup-overlay">
          <div className="role-popup">
            <h2>Changes Saved</h2>
            <p>
              Changes to the <strong>{savedRole}</strong> role have been saved.
            </p>
            <button
              className="popup-close-button"
              onClick={() => setShowSavePopup(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleManagement;
