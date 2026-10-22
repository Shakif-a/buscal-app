import "../../src/index.css";
import "../../src/okrTracker/pages/objectives/ObjectivesPage.css";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import objectiveReducer from "../../src/okrTracker/features/objectives/objectiveSlice";
import userReducer from "../../src/okrTracker/features/users/userSlice";
import ObjectiveCard from "../../src/okrTracker/pages/objectives/ObjectiveCard";
import Reports from "../../src/okrTracker/pages/reports/Reports";

const params = new URLSearchParams(window.location.search);
const user = { token: "test-token", roles: ["admin"], exec: "no" };
const store = configureStore({
  reducer: {
    auth: () => ({ user }),
    okr: objectiveReducer,
    users: userReducer,
  },
});
const objective = {
  _id: "objective-1",
  title: "Improve support",
  group: "Support",
  manager: "Test Owner",
  owner: { _id: "owner-1" },
  type: "Committed",
  dueDate: "2026-12-01",
  progress: 30,
  canManage: params.get("manage") !== "false",
  canCreateKeyResult: params.get("create") !== "false",
  canEditKeyResults: params.get("edit") !== "false",
  canApproveKeyResult: params.get("approve") !== "false",
};

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    {params.get("page") === "reports" ? (
      <Reports />
    ) : (
      <ObjectiveCard objective={objective} />
    )}
  </Provider>,
);
