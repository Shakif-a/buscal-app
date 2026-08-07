import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";


function Navbar() {
  const navy = "#1a2b4a";

  const [openMenu, setOpenMenu] = useState(null);
  const [hoverTab, setHoverTab] = useState(null);
  const [hoverItem, setHoverItem] = useState(null);
  const location = useLocation();
  function isActive(path) {
    return location.pathname.startsWith(path);
  }
  function tabStyle(key, active) {
    const highlighted = active || hoverTab === key;
    return {
      color: navy,
      fontWeight: "600",
      fontSize: "16px",
      textDecoration: "none",
      padding: "8px 16px",
      borderRadius: "8px",
      backgroundColor: highlighted ? "#e8f0fb" : "transparent",
      cursor: "pointer",
      transition: "background-color 0.15s ease",
      display: "inline-block",
    };
  }

  function dropdown(name, label, basePath, items) {
    const active = isActive(basePath);
    const open = openMenu === name;
    return (
      <div
        onMouseEnter={() => {
          setOpenMenu(name);
          setHoverTab(name);
        }}
        onMouseLeave={() => {
          setOpenMenu(null);
          setHoverTab(null);
        }}
        style={{ position: "relative" }}
      >
        <span style={tabStyle(name, active)}>
          {label}
          {/* A small arrow that flips up when the menu is open */}
          <span
            style={{
              display: "inline-block",
              marginLeft: "6px",
              fontSize: "11px",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            &#9662;
          </span>
        </span>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              paddingTop: "10px",
              zIndex: 100,
            }}
          >
            <div
              style={{
                position: "relative",
                backgroundColor: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(26,43,74,0.15)",
                padding: "8px",
                minWidth: "220px",
              }}
            >
              {/* A little pointer */}
              <div
                style={{
                  position: "absolute",
                  top: "-6px",
                  left: "24px",
                  width: "12px",
                  height: "12px",
                  backgroundColor: "#fff",
                  borderLeft: "1px solid #eef0f4",
                  borderTop: "1px solid #eef0f4",
                  transform: "rotate(45deg)",
                }}
              ></div>

              {items.map((item) => {
                const itemHover = hoverItem === item.label;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setOpenMenu(null)}
                    onMouseEnter={() => setHoverItem(item.label)}
                    onMouseLeave={() => setHoverItem(null)}
                    style={{
                      display: "block",
                      padding: "12px 16px",
                      color: navy,
                      fontSize: "15px",
                      fontWeight: "500",
                      textDecoration: "none",
                      borderRadius: "8px",
                      whiteSpace: "nowrap",
                      backgroundColor: itemHover ? "#f2f6fb" : "transparent",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "16px 40px",
        gap: "28px",
        fontFamily: "sans-serif",
        backgroundColor: "#fff",
        borderBottom: "1px solid #eef0f4",
        boxShadow: "0 2px 8px rgba(26,43,74,0.05)",
      }}
    >
      {/* Logo links back to the dashboard */}
      <Link to="/dashboard/okrtracker/okrdashboard" style={{ textDecoration: "none", marginRight: "12px" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "24px" }}>
            <span style={{ color: navy }}>micro</span>
            <span style={{ color: "#4a7c9e" }}>max</span>
            <span style={{ color: "#2e7d5b" }}> ))</span>
          </div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", color: navy }}>
            technology
          </div>
        </div>
      </Link>

      {/* Dashboard link */}
      <Link
        to="/dashboard/okrtracker/okrdashboard"
        onMouseEnter={() => setHoverTab("dashboard")}
        onMouseLeave={() => setHoverTab(null)}
        style={tabStyle("dashboard", isActive("/dashboard/okrtracker/okrdashboard"))}
      >
        Dashboard
      </Link>

      {/* Objectives dropdown */}
      {dropdown("objectives", "Objectives", "/dashboard/okrtracker/objectives", [
        { label: "Create Objective", path: "/dashboard/okrtracker/objectives/create" },
        { label: "All Objectives", path: "/dashboard/okrtracker/objectives" },
      ])}

      {/* Reports link */}
      <Link
        to="/dashboard/okrtracker/reports"
        onMouseEnter={() => setHoverTab("reports")}
        onMouseLeave={() => setHoverTab(null)}
        style={tabStyle("reports", isActive("/dashboard/okrtracker/reports"))}
      >
        Reports
      </Link>

      {/* Admin dropdown */}
      {dropdown("admin", "Admin", "/dashboard/okrtracker/admin", [
        { label: "Role Management", path: "/dashboard/okrtracker/admin/roles" },
        { label: "Group Management", path: "/dashboard/okrtracker/admin/groups" },
      ])}

      {/* Profile icon */}
      <div style={{ marginLeft: "auto" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            backgroundColor: "#e8ebf0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          &#128100;
        </div>
      </div>
    </div>
  );
}

export default Navbar;