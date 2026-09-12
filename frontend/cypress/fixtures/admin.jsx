import React from "react";
import "../../src/index.css";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Navbar from "../../src/pages/navigation/navigation";
import GroupManagement from "../../src/okrTracker/pages/admin/GroupManagement";
import RoleManagement from "../../src/okrTracker/pages/admin/RoleManagement";

const params = new URLSearchParams(window.location.search);
const access = params.get("access") || "admin";
const user = {
  token: "test-token",
  roles: access === "admin" ? ["admin"] : [],
  exec: access === "executive" ? "yes" : "no",
  companyRoles: access === "manager" ? [{ managementLevel: 2 }] : [],
};
const store = configureStore({ reducer: () => ({ auth: { user } }) });
const page = params.get("page") || "groups";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={[`/dashboard/okrtracker/admin/${page}`]}>
      <Navbar />
      <Routes>
        <Route path="/dashboard/okrtracker/admin/groups" element={<GroupManagement />} />
        <Route path="/dashboard/okrtracker/admin/roles" element={<RoleManagement />} />
      </Routes>
    </MemoryRouter>
  </Provider>
);
