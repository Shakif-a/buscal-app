import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import adminService from "../../features/admin/adminService";
import "./RoleManagement.css";

const permissionList = [
  "Create Objectives",
  "Edit Objectives",
  "Create Key Results",
  "Approve Key Results",
  "View Reports",
  "Manage Users",
  "Manage Roles",
  "Manage Groups",
];

const roleNames = ["Admin", "Manager", "Employee"];

const defaultRoles = {
  Admin: permissionList,
  Manager: [
    "Create Objectives",
    "Edit Objectives",
    "Create Key Results",
    "Approve Key Results",
    "View Reports",
  ],
  Employee: ["View Reports"],
};

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

function makeRoleState(rows) {
  const result = {};

  for (let i = 0; i < roleNames.length; i++) {
    const roleName = roleNames[i];
    const savedRole = rows.find((row) => row.role === roleName);
    const savedPermissions = savedRole ? savedRole.permissions : [];
    result[roleName] = {};

    for (let j = 0; j < permissionList.length; j++) {
      const permission = permissionList[j];
      result[roleName][permission] = savedPermissions.includes(permission);
    }
  }

  return result;
}

function makeDefaultRoleState() {
  const rows = [];

  for (let i = 0; i < roleNames.length; i++) {
    const role = roleNames[i];
    rows.push({ role, permissions: defaultRoles[role] });
  }

  return makeRoleState(rows);
}

function RoleManagement() {
  const { user } = useSelector((state) => state.auth);
  const [roles, setRoles] = useState(makeDefaultRoleState());
  const [expandedRole, setExpandedRole] = useState("Manager");
  const [searchText, setSearchText] = useState("");
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savedRole, setSavedRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const allowed = canManageAdmin(user);

  useEffect(() => {
    async function loadPermissions() {
      if (!allowed) {
        setIsLoading(false);
        return;
      }

      try {
        const savedRoles = await adminService.getPermissions(user.token);
        setRoles(makeRoleState(savedRoles));
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    loadPermissions();
  }, [allowed, user]);

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
      const defaults = makeDefaultRoleState();
      return { ...previous, [roleName]: defaults[roleName] };
    });
  }

  async function saveRole(roleName) {
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
        user.token
      );

      setRoles((previous) => ({
        ...previous,
        [roleName]: makeRoleState([saved])[roleName],
      }));
      setSavedRole(roleName);
      setShowSavePopup(true);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  const visibleRoles = roleNames.filter((name) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );

  const permissionReference = [
    { area: "Dashboard", manager: "Read", employee: "Read" },
    { area: "Calendar", manager: "Read", employee: "Read" },
    { area: "Objectives (all)", manager: "Full Access", employee: "Read" },
    { area: "Objectives (create)", manager: "Full Access", employee: "No Access" },
    { area: "Key Results", manager: "Full Access", employee: "Read" },
    { area: "Reports", manager: "Full Access", employee: "Read, create" },
    { area: "Admin", manager: "Full Access", employee: "No Access" },
  ];

  if (!allowed) {
    return (
      <div className="role-management">
        <div className="role-status role-error">
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
        <div className="role-status role-error">{errorMessage}</div>
      )}

      <div className="role-search-row">
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search role..."
          className="role-search-input"
        />
      </div>

      <div className="role-content-box">
        {isLoading && <div className="role-status">Loading permissions...</div>}

        {!isLoading && (
          <>
            <div className="role-table-header">
              <div>ROLE</div>
              <div>ACTIONS</div>
            </div>

            {visibleRoles.map((roleName) => (
              <div key={roleName}>
                <div className="role-table-row">
                  <div className="role-name">{roleName}</div>
                  <div>
                    <button
                      onClick={() => toggleExpand(roleName)}
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
                          <label key={permission} className="role-permission-label">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(roleName, permission)}
                              className="role-permission-checkbox-input"
                            />
                            <span
                              className={`role-permission-checkbox ${
                                isChecked ? "checked" : ""
                              }`}
                            >
                              {isChecked ? "✓" : ""}
                            </span>
                            <span className="role-permission-name">{permission}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="role-action-buttons">
                      <button
                        onClick={() => resetRole(roleName)}
                        className="role-reset-button"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => saveRole(roleName)}
                        className="role-save-button"
                      >
                        Save Changes
                      </button>
                    </div>
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
          <div className="role-reference-table-header">
            <div>AREA</div>
            <div>MANAGER / EXECUTIVE / ADMIN</div>
            <div>EMPLOYEE</div>
          </div>

          {permissionReference.map((row) => (
            <div key={row.area} className="role-reference-table-row">
              <div className="role-reference-area">{row.area}</div>
              <div className="role-reference-value">{row.manager}</div>
              <div className="role-reference-value">{row.employee}</div>
            </div>
          ))}
        </div>
      </div>

      {showSavePopup && (
        <div className="popup-overlay">
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
