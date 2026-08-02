import React, { useState } from "react";

// Role Management admin page for the OKR Calendar app.
// This recreates the design: top nav bar, page header, a searchable
// list of roles, an expandable permissions panel with checkboxes,
// Reset and Save Changes buttons, and a permission reference table.

function RoleManagement() {
  // The dark navy colour used for headings and text.
  const navy = "#1a2b4a";

  // The list of permissions shown for a role, laid out in two columns.
  // The order here matches the screenshot: left column first, then right.
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

  // The default permissions for each role. true means the box is ticked.
  // We keep a copy of these defaults so the Reset button can restore them.
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

  // The list of role names in the order they appear.
  const roleNames = ["Admin", "Manager", "Employee"];

  // The current, editable permission state for every role.
  const [roles, setRoles] = useState(defaultRoles);

  // Which role row is currently expanded. Manager is open to match
  // the screenshot. null means no role is expanded.
  const [expandedRole, setExpandedRole] = useState("Manager");

  // The text typed into the role search box.
  const [searchText, setSearchText] = useState("");

  // The rows for the permission reference table at the bottom.
  const permissionReference = [
    { area: "Dashboard", manager: "Read", employee: "Read" },
    { area: "Calendar", manager: "Read", employee: "Read" },
    { area: "Objectives (all)", manager: "Full Access", employee: "Read" },
    { area: "Objectives (create)", manager: "Full Access", employee: "No Access" },
    { area: "Key Results", manager: "Full Access", employee: "Read" },
    { area: "Reports", manager: "Full Access", employee: "Read, Create" },
    { area: "Admin (all)", manager: "Full Access", employee: "No Access" },
  ];

  // Open or close the permissions panel for a given role.
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
  // is no backend connected yet. Replace this with an API call later.
  function saveRole(roleName) {
    alert("Changes saved for " + roleName + " role.");
  }

  // Filter the roles by the search text.
  const visibleRoles = roleNames.filter((name) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Top navigation bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "20px 40px",
          gap: "40px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: "bold", fontSize: "24px" }}>
            <span style={{ color: navy }}>micro</span>
            <span style={{ color: "#4a7c9e" }}>max</span>
            <span style={{ color: "#2e7d5b" }}> ))</span>
          </div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", color: navy }}>
            technology
          </div>
        </div>

        {/* Nav links */}
        <div style={{ color: navy, fontWeight: "600", cursor: "pointer" }}>Dashboard</div>
        <div style={{ color: navy, fontWeight: "600", cursor: "pointer" }}>Objectives ▾</div>
        <div style={{ color: navy, fontWeight: "600", cursor: "pointer" }}>Key Results</div>
        <div style={{ color: navy, fontWeight: "600", cursor: "pointer" }}>Reports</div>

        {/* Admin button, highlighted as the active page */}
        <div
          style={{
            color: navy,
            fontWeight: "600",
            backgroundColor: "#d6e4f5",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Admin ▾
        </div>

        {/* Profile icon pushed to the far right */}
        <div style={{ marginLeft: "auto" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#e8ebf0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            👤
          </div>
        </div>
      </div>

      {/* Top level search bar */}
      <div style={{ padding: "0 40px", display: "flex", justifyContent: "flex-end" }}>
        <input
          type="text"
          placeholder="Search"
          style={{
            width: "300px",
            padding: "12px 16px",
            borderRadius: "24px",
            border: "1px solid #ddd",
            outline: "none",
          }}
        />
      </div>

      {/* Page header card */}
      <div style={{ padding: "30px 40px" }}>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "16px",
            padding: "24px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "#2e7d5b", fontSize: "24px" }}>((</span>
            <span style={{ color: navy, fontSize: "26px", fontWeight: "bold" }}>
              Role Management
            </span>
          </div>
          <span style={{ color: "#2e7d5b", fontSize: "24px" }}>))</span>
        </div>
      </div>

      {/* Main content card */}
      <div style={{ padding: "0 40px 40px" }}>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "16px",
            padding: "30px",
          }}
        >
          {/* Search role input and Add Role button */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="🔍  Search role..."
              style={{
                width: "45%",
                padding: "14px 18px",
                borderRadius: "10px",
                border: "1px solid #ddd",
                backgroundColor: "#f7f8fa",
                outline: "none",
              }}
            />
            <button
              onClick={() => alert("Add Role clicked")}
              style={{
                color: "#2e6da4",
                fontWeight: "bold",
                fontSize: "18px",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              (+) Add Role
            </button>
          </div>

          {/* Table header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 3fr",
              padding: "0 10px 12px",
              borderBottom: "1px solid #eee",
              color: "#888",
              fontWeight: "600",
              letterSpacing: "1px",
              fontSize: "14px",
            }}
          >
            <div>ROLE</div>
            <div>ACTIONS</div>
          </div>

          {/* Role rows */}
          {visibleRoles.map((roleName) => (
            <div key={roleName}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 3fr",
                  alignItems: "center",
                  padding: "22px 10px",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ color: navy, fontSize: "18px" }}>{roleName}</div>
                <div>
                  <button
                    onClick={() => toggleExpand(roleName)}
                    style={{
                      padding: "10px 30px 10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                      backgroundColor: "#fff",
                      color: navy,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    Edit
                    <span style={{ position: "absolute", right: "10px", color: "#aaa" }}>
                      {expandedRole === roleName ? "▴" : "▾"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Expanded permissions panel, only for the open role */}
              {expandedRole === roleName && (
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: "12px",
                    padding: "24px 30px",
                    margin: "16px 0",
                  }}
                >
                  <div
                    style={{
                      color: navy,
                      fontSize: "18px",
                      fontWeight: "bold",
                      marginBottom: "20px",
                    }}
                  >
                    Permissions for {roleName}
                  </div>

                  {/* Permissions laid out in two columns */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      rowGap: "20px",
                      marginBottom: "30px",
                    }}
                  >
                    {permissionList.map((permission) => {
                      const isChecked = roles[roleName][permission];
                      return (
                        <label
                          key={permission}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            cursor: "pointer",
                          }}
                        >
                          {/* Custom coloured checkbox */}
                          <span
                            onClick={() => togglePermission(roleName, permission)}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "6px",
                              border: isChecked ? "none" : "2px solid #ccc",
                              backgroundColor: isChecked ? "#4caf7d" : "#fff",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                            }}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span style={{ color: navy, fontSize: "17px" }}>{permission}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Reset and Save Changes buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px" }}>
                    <button
                      onClick={() => resetRole(roleName)}
                      style={{
                        padding: "12px 28px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        backgroundColor: "#f2f2f2",
                        color: navy,
                        cursor: "pointer",
                      }}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => saveRole(roleName)}
                      style={{
                        padding: "12px 28px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#7fbce0",
                        color: "#fff",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
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

      {/* Permission reference card */}
      <div style={{ padding: "0 40px 60px" }}>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "16px",
            padding: "30px",
          }}
        >
          <div
            style={{
              color: "#888",
              fontWeight: "600",
              letterSpacing: "1px",
              fontSize: "15px",
              marginBottom: "20px",
            }}
          >
            PERMISSION REFERENCE
          </div>

          {/* Reference table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "0 10px 14px",
              borderBottom: "1px solid #eee",
              color: "#888",
              fontWeight: "600",
              letterSpacing: "1px",
              fontSize: "14px",
            }}
          >
            <div>AREA</div>
            <div>MANAGER / EXECUTIVE / ADMIN</div>
            <div>EMPLOYEE</div>
          </div>

          {/* Reference table rows */}
          {permissionReference.map((row) => (
            <div
              key={row.area}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                padding: "18px 10px",
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              <div style={{ color: navy, fontSize: "17px", fontWeight: "600" }}>{row.area}</div>
              <div style={{ color: "#666", fontSize: "17px" }}>{row.manager}</div>
              <div style={{ color: "#666", fontSize: "17px" }}>{row.employee}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RoleManagement;