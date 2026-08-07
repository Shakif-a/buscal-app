import React, { useState } from "react";

function RoleManagement() {
  // The dark navy colour used for headings and text.
  const navy = "#1a2b4a";

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
    alert("Changes saved for " + roleName + " role.");
  }

  // Filter the roles by the search text.
  const visibleRoles = roleNames.filter((name) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", fontFamily: "sans-serif" }}>

      {/* Page header */}
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
            {/*<span style={{ color: "#2e7d5b", fontSize: "24px" }}>((</span>*/}
            <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"/>
            <span style={{ color: navy, fontSize: "26px", fontWeight: "bold" }}>
              Role Management
            </span>
          </div>
          <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
          {/*<span style={{ color: "#2e7d5b", fontSize: "24px" }}>))</span>*/}
        </div>
      </div>

      {/* Main content */}
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

      {/* Permission reference */}
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