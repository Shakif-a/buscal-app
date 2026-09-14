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
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [expandedRole, setExpandedRole] = useState("Manager");
  const [searchText, setSearchText] = useState("");
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savedRole, setSavedRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      setSelectedRole(
        users.find((person) => person._id === selectedUser)?.okrRole || "",
      );
    }
  }

  async function changeRole(action, role) {
    if (isSaving || !canEdit) return;
    let name;
    if (action !== "delete") {
      name = window.prompt(
        action === "create"
          ? "Enter a name for the new role:"
          : "Enter the new role name:",
        role || "",
      );
      if (!name || !name.trim()) return;
    } else if (
      !window.confirm(`Delete ${role}? Users must be reassigned first.`)
    )
      return;
    setIsSaving(true);
    try {
      if (action === "create") await adminService.createRole(name, user.token);
      if (action === "rename")
        await adminService.renameRole(role, name, user.token);
      if (action === "delete") await adminService.deleteRole(role, user.token);
      await loadRoles();
      setStatusMessage("Role changes saved.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function assignRole() {
    if (!selectedUser || isSaving || !canAssign) return;
    setIsSaving(true);
    try {
      await adminService.assignRole(
        selectedUser,
        selectedRole || null,
        user.token,
      );
      await loadRoles();
      setStatusMessage("User role saved.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleExpand(roleName) {
    if (expandedRole === roleName) {
      setExpandedRole(null);
    } else {
      setExpandedRole(roleName);
    }
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
        <button
          className="role-edit-button"
          disabled={isLoading || isSaving || !canEdit}
          onClick={() => changeRole("create")}
        >
          Add Role
        </button>
        {isLoading && <div className="role-status">Loading permissions...</div>}

        {!isLoading && roles && (
          <>
            <div className="role-table-header">
              <div>ROLE</div>
              <div>ACTIONS</div>
            </div>

            {visibleRoles.length === 0 && (
              <div className="role-status">No roles found.</div>
            )}

            {visibleRoles.map((roleName) => (
              <div key={roleName}>
                <div className="role-table-row">
                  <div className="role-name">{roleName}</div>
                  <div>
                    {!roleRows.find((row) => row.role === roleName).system && (
                      <>
                        <button
                          disabled={isSaving || !canEdit}
                          onClick={() => changeRole("rename", roleName)}
                        >
                          Rename
                        </button>
                        <button
                          disabled={isSaving || !canEdit}
                          onClick={() => changeRole("delete", roleName)}
                        >
                          Delete
                        </button>
                      </>
                    )}
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

                        return (
                          <label
                            key={permission}
                            className="role-permission-label"
                          >
                            <input
                              type="checkbox"
                              disabled={
                                isSaving ||
                                !canEdit ||
                                !roleRows
                                  .find((row) => row.role === roleName)
                                  .allowedPermissions.includes(permission)
                              }
                              checked={isChecked}
                              onChange={() =>
                                togglePermission(roleName, permission)
                              }
                              className="role-permission-checkbox-input"
                            />
                            <span
                              className={`role-permission-checkbox ${
                                isChecked ? "checked" : ""
                              }`}
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
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {canAssign && (
        <div className="role-reference-section">
          <h2>Assign an OKR role</h2>
          <label>
            User{" "}
            <select
              aria-label="User for OKR role"
              value={selectedUser}
              disabled={isSaving}
              onChange={(event) => {
                setSelectedUser(event.target.value);
                setSelectedRole(
                  people.find((person) => person._id === event.target.value)
                    ?.okrRole || "",
                );
              }}
            >
              <option value="">Select a user</option>
              {people
                .filter((person) => !canManageAdmin(person))
                .map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            OKR role{" "}
            <select
              aria-label="Assigned OKR role"
              value={selectedRole}
              disabled={isSaving}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              <option value="">Use account and company role</option>
              {roleRows
                .filter((row) => !row.system)
                .map((row) => (
                  <option key={row.role} value={row.role}>
                    {row.role}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={!selectedUser || isSaving} onClick={assignRole}>
            Save user role
          </button>
        </div>
      )}

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
            here. Custom roles control OKR work and can be assigned to users.
            System roles cannot be renamed or deleted. Removing Manage Roles
            also removes access to this editor; a database operator can restore
            it with the admin access recovery script. Employee objective access
            remains limited to ownership and managed groups. Reset to defaults
            changes the draft; select Save Changes to apply it.
          </p>
        </div>
      </div>

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
