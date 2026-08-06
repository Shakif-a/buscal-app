import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

function NavigationTabs() {
  const [objectivesOpen, setObjectivesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const { user } = useSelector((state) => state.auth);
  const location = useLocation();

  const isAdmin = user?.roles?.includes("admin");

  const objectivesActive =
    location.pathname === "/objectives" ||
    location.pathname === "/dashboard/objectives/create";

  const adminActive =
    location.pathname === "/dashboard/admin/groups" ||
    location.pathname === "/dashboard/admin/roles";

  const normalLink = {
    textDecoration: "none",
    color: "#1F1E40",
    fontSize: "18px",
    padding: "16px 22px",
    borderRadius: "14px",
    display: "block",
  };

  const activeLink = {
    ...normalLink,
    backgroundColor: "#CFE2F3",
    fontWeight: "600",
  };

  function getLinkStyle({ isActive }) {
    return isActive ? activeLink : normalLink;
  }

  function closeMenus() {
    setObjectivesOpen(false);
    setAdminOpen(false);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "18px 28px",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #CFE2F3",
          fontFamily: '"Avenir", "Helvetica", sans-serif',
        }}
      >
        <img
          src="/images/logo.png"
          alt="Micromax Technology"
          style={{
            width: "195px",
            marginRight: "25px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <NavLink to="/okr-dashboard" style={getLinkStyle}>
            Dashboard
          </NavLink>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setObjectivesOpen(!objectivesOpen);
                setAdminOpen(false);
              }}
              style={{
                border: "none",
                backgroundColor:
                  objectivesActive || objectivesOpen
                    ? "#CFE2F3"
                    : "transparent",
                color: "#1F1E40",
                fontSize: "18px",
                padding: "16px 22px",
                borderRadius: "14px",
                cursor: "pointer",
                fontFamily: '"Avenir", "Helvetica", sans-serif',
                fontWeight: objectivesActive ? "600" : "400",
              }}
            >
              Objectives
              <span
                style={{
                  color: "#72CDF4",
                  marginLeft: "10px",
                  fontSize: "20px",
                }}
              >
                {objectivesOpen ? "▲" : "▼"}
              </span>
            </button>

            {objectivesOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "62px",
                  left: "0",
                  width: "220px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #CFE2F3",
                  borderRadius: "8px",
                  padding: "8px",
                  zIndex: 20,
                }}
              >
                <NavLink
                  to="/objectives"
                  style={getLinkStyle}
                  onClick={closeMenus}
                >
                  All Objectives
                </NavLink>

                <NavLink
                  to="/dashboard/objectives/create"
                  style={getLinkStyle}
                  onClick={closeMenus}
                >
                  Create Objective
                </NavLink>
              </div>
            )}
          </div>

          <NavLink to="/report" style={getLinkStyle}>
            Reports
          </NavLink>

          {isAdmin && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setAdminOpen(!adminOpen);
                  setObjectivesOpen(false);
                }}
                style={{
                  border: "none",
                  backgroundColor:
                    adminActive || adminOpen ? "#CFE2F3" : "transparent",
                  color: "#1F1E40",
                  fontSize: "18px",
                  padding: "16px 22px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontFamily: '"Avenir", "Helvetica", sans-serif',
                  fontWeight: adminActive ? "600" : "400",
                }}
              >
                Admin
                <span
                  style={{
                    color: "#72CDF4",
                    marginLeft: "10px",
                    fontSize: "20px",
                  }}
                >
                  {adminOpen ? "▲" : "▼"}
                </span>
              </button>

              {adminOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "62px",
                    left: "0",
                    width: "230px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #CFE2F3",
                    borderRadius: "8px",
                    padding: "8px",
                    zIndex: 20,
                  }}
                >
                  <NavLink
                    to="/dashboard/admin/groups"
                    style={getLinkStyle}
                    onClick={closeMenus}
                  >
                    Group Management
                  </NavLink>

                  <NavLink
                    to="/dashboard/admin/roles"
                    style={getLinkStyle}
                    onClick={closeMenus}
                  >
                    Role Management
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            marginLeft: "auto",
            width: "55px",
            height: "55px",
            borderRadius: "50%",
            border: "2px solid #CFE2F3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1F1E40",
            fontSize: "32px",
          }}
        >
          ●
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "24px 38px",
          backgroundColor: "#ffffff",
          fontFamily: '"Avenir", "Helvetica", sans-serif',
        }}
      >
        <input
          type="text"
          placeholder="Search"
          style={{
            width: "400px",
            padding: "16px 20px",
            border: "1px solid #CFE2F3",
            borderRadius: "10px",
            backgroundColor: "#eef3f8",
            color: "#1F1E40",
            fontSize: "17px",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

export default NavigationTabs;