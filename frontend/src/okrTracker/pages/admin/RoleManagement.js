import React, { useState } from "react";
import "./RoleManagement.css";

function RoleManagement() {
  // The list of permissions shown for a role
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

  const defaultRoles = {
    Admin: {
      "Create Objectives": true,
      "Edit Objectives": true,
      "Create Key Results": true,
      "Approve Key Results": true,
      "View Reports": true,
      "Manage Users": true,
      "Manage Roles": true,
      "Manage Groups": true,
    },
    Manager: {
      "Create Objectives": true,
      "Edit Objectives": true,
      "Create Key Results": true,
      "Approve Key Results": true,
      "View Reports": true,
      "Manage Users": false,
      "Manage Roles": false,
      "Manage Groups": false,
    },
    Employee: {
      "Create Objectives": false,
      "Edit Objectives": false,
      "Create Key Results": false,
      "Approve Key Results": false,
      "View Reports": true,
      "Manage Users": false,
      "Manage Roles": false,
      "Manage Groups": false,
    },
  };

  // The list of role names
  const roleNames = ["Admin", "Manager", "Employee"];

  // The editable permission state for every role.
  const [roles, setRoles] = useState(defaultRoles);

  const [expandedRole, setExpandedRole] = useState("Manager");

  // The text typed into the role search box.
  const [searchText, setSearchText] = useState("");

  const permissionReference = [
    { area: "Dashboard", manager: "Read", employee: "Read" },
    { area: "Calendar", manager: "Read", employee: "Read" },
    { area: "Objectives (all)", manager: "Full Access", employee: "Read" },
    { area: "Objectives (create)", manager: "Full Access", employee: "No Access" },
    { area: "Key Results", manager: "Full Access", employee: "Read" },
    { area: "Reports", manager: "Full Access", employee: "Read, create" },
    { area: "Admin", manager: "Full Access", employee: "No Access" },
  ];

  // Open or close the permissions panel for a role.
  function toggleExpand(roleName) {
    if (expandedRole === roleName) {
      setExpandedRole(null);
    } else {
      setExpandedRole(roleName);
    }
  }

  // Tick or untick a single permission for the given role.
  function togglePermission(roleName, permission) {
    setRoles((previous) => {
      const updatedRole = {
        ...previous[roleName],
        [permission]: !previous[roleName][permission],
      };
      return { ...previous, [roleName]: updatedRole };
    });
  }

  // Reset a role's permissions back to the defaults.
  function resetRole(roleName) {
    setRoles((previous) => {
      return { ...previous, [roleName]: { ...defaultRoles[roleName] } };
    });
  }

  // Save the changes. Here we just show a confirmation, since there
  // is no backend connected yet. we have to Replace this with an API call later.
  function saveRole(roleName) {
    setSavedRole(roleName);
    setShowSavePopup(true);
  }

  // Filter the roles by the search text.
  const visibleRoles = roleNames.filter((name) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );

  const [showSavePopup,setShowSavePopup] = useState(false);
  const [savedRole, setSavedRole] = useState("");

  return (
    <div className="role-management">

      {/* Page header */}
      <div className="role-header">
        <div className="role-header-title">
          <div className="role-header-title-inner">
            <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"/>
            <h1>Role Management</h1>
          </div>
          <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
        </div>
      </div>

      {/* Main content */}
      <div>
        {/* Search role input */}
        <div className="role-search-row">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="  Search role..."
              className="role-search-input"
            />
          </div>
          <div className="role-content-box">  
          {/* Add Role button */}
          <div className="role-add-section">
            <button
              onClick={() => alert("Add Role clicked")}
              className="role-add-button"
          >    
              (+)Add Role
            </button>
          </div>

          {/* Table header row */}
          <div className="role-table-header">
            <div>ROLE</div>
            <div>ACTIONS</div>
          </div>

          {/* Role rows */}
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

              {/* Expanded permissions panel, only for the open role */}
              {expandedRole === roleName && (
                <div className="role-permissions-panel">
                  <div
                    className="role-permissions-title">
                    Permissions for {roleName}
                  </div>

                  {/* Permissions laid out in two columns */}
                  <div className="role-permissions-grid">
                    {permissionList.map((permission) => {
                      const isChecked = roles[roleName][permission];
                      return (
                        <label
                          key={permission}
                          className="role-permission-label"
                        >
                          {/* Custom coloured checkbox */}
                          <span
                            onClick={() => togglePermission(roleName, permission)}
                            className={`role-permission-checkbox ${isChecked ? "checked" : ""}`}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className="role-permission-name">{permission}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Reset and Save Changes buttons */}
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
      </div>

      {/* Permission reference */}
      <div className="role-reference-section">
        <div
          className="role-reference-box"
        >
          <div className="role-reference-title">
            PERMISSION REFERENCE
          </div>

          {/* Reference table header */}
          <div className="role-reference-table-header">
            <div>AREA</div>
            <div>MANAGER / EXECUTIVE / ADMIN</div>
            <div>EMPLOYEE</div>
          </div>

          {/* Reference table rows */}
          {permissionReference.map((row) => (
            <div
              key={row.area}
              className="role-reference-table-row">
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
            <p>Changes to the <strong>{savedRole}</strong> role have been saved.</p>
            <button className="popup-close-button"
            onClick={() => setShowSavePopup(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleManagement;