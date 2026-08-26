import React, { useEffect, useState } from "react";
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
  Admin: [...permissionList],
  Manager: [
    "Create Objectives",
    "Edit Objectives",
    "Create Key Results",
    "Approve Key Results",
    "View Reports",
  ],
  Employee: ["View Reports"],
};

function getErrorMessage(error) {
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }

  return "Something went wrong";
}

function makeRoleState(roleList) {
  const result = {};

  for (let i = 0; i < roleList.length; i++) {
    result[roleList[i].role] = roleList[i].permissions;
  }

  return result;
}

function RoleManagement() {
  const [roles, setRoles] = useState(defaultRoles);
  const [expandedRole, setExpandedRole] = useState("Manager");
  const [searchText, setSearchText] = useState("");
  const [savedRole, setSavedRole] = useState("");
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPermissions();
  }, []);

  async function loadPermissions() {
    try {
      setLoading(true);
      setError("");
      const savedPermissions = await adminService.getPermissions();
      setRoles(makeRoleState(savedPermissions));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
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
    const currentPermissions = roles[roleName] || [];
    let updatedPermissions;

    if (currentPermissions.includes(permission)) {
      updatedPermissions = currentPermissions.filter(
        (name) => name !== permission
      );
    } else {
      updatedPermissions = [...currentPermissions, permission];
    }

    setRoles({
      ...roles,
      [roleName]: updatedPermissions,
    });
  }

  function resetRole(roleName) {
    setRoles({
      ...roles,
      [roleName]: [...defaultRoles[roleName]],
    });
  }

  async function saveRole(roleName) {
    try {
      setError("");
      const saved = await adminService.updatePermissions(
        roleName,
        roles[roleName]
      );

      setRoles({
        ...roles,
        [roleName]: saved.permissions,
      });
      setSavedRole(roleName);
      setShowSavePopup(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const visibleRoles = roleNames.filter((name) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );

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
        {error && <div className="role-error">{error}</div>}
        {loading && <div className="role-message">Loading roles...</div>}

        <div className="role-table-header">
          <div>ROLE</div>
          <div>ACTIONS</div>
        </div>

        {!loading &&
          visibleRoles.map((roleName) => (
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
                    {permissionList.map((permission) => (
                      <label key={permission} className="role-permission-label">
                        <input
                          type="checkbox"
                          checked={(roles[roleName] || []).includes(permission)}
                          onChange={() =>
                            togglePermission(roleName, permission)
                          }
                          className="role-permission-checkbox"
                        />
                        <span className="role-permission-name">
                          {permission}
                        </span>
                      </label>
                    ))}
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
      </div>

      {showSavePopup && (
        <div className="popup-overlay">
          <div className="role-popup">
            <h2>Changes Saved</h2>
            <p>Changes to the {savedRole} role have been saved.</p>
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
