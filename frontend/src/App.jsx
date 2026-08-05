import { Routes, Route, Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Auth
import Login from "./components/Authenticate/Login";
import Logout from "./components/Authenticate/Logout";
import Register from "./components/Authenticate/Register";
import ForgotPassword from "./components/Authenticate/ForgotPassword";
import ResetPassword from "./components/Authenticate/ResetPassword";
import PageNotFound from "./components/Authenticate/PageNotFound";

// Pages
import HomePage from "./pages/home/HomePage";
import NotificationsArchive from "./pages/NotificationsArchive";

// Account
import Account from "./pages/account/Account";
import AccountDetails from "./pages/account/AccountDetails/AccountDetails";
import ManageAccounts from "./pages/account/AccountDetails/ManageAccounts";
import Contact from "./pages/account/Contact";
import QMAccountHeader from "./pages/account/QMAccountHeader";

// Business Calendar
import BusinessCalendarHome from "./businessCalendar/pages/BusinessCalendarHome";
import HistoryCalendar from "./businessCalendar/pages/HistoryCalendar";
import CalendarView from "./businessCalendar/pages/CalendarView";
import BusCalAdmin from "./businessCalendar/pages/BusCalAdmin";

// OKR
import OkrDashboard from "./pages/OkrDashboard";
// OKR Tracker
import DevPlayground from "./okrTracker/pages/DevPlayground";
import GroupManagement from "./okrTracker/pages/admin/GroupManagement";
import RoleManagement from "./okrTracker/pages/admin/RoleManagement";
import ObjectivesPage from "./okrTracker/pages/objectives/ObjectivesPage";
import CreateObjectives from "./okrTracker/pages/objectives/CreateObjectives";

// Shell
import Nav from "./pages/navigation/Nav";
import RequireAuth from "./components/Authenticate/RequireAuth";

const ROLES = {
  employee: "employee",
  qm: "qm",
  admin: "admin",
  pending: "pending",
  salesTeam: "salesTeam",
};

function Layout() {
  return <Outlet />;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>

          {/* ---------------- PUBLIC ROUTES ---------------- */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:resetToken" element={<ResetPassword />} />
          <Route path="/logout" element={<Logout />} />


          {/* ---------------- AUTH: ALL ROLES ---------------- */}
          <Route
            element={
              <RequireAuth
                allowedRoles={[
                  ROLES.employee,
                  ROLES.qm,
                  ROLES.pending,
                  ROLES.admin,
                  ROLES.salesTeam,
                ]}
              />
            }
          >
            <Route path="/dashboard" element={<HomePage />} />

            <Route
              path="/dashboard/notifications"
              element={<Nav main={[<NotificationsArchive />]} />}
            />

            <Route
              path="/dashboard/settings"
              element={<Nav main={[<Account />]} />}
            />

            <Route
              path="/dashboard/settings/contact"
              element={<Nav main={[<Contact />]} />}
            />
          </Route>

          {/* ---------------- BUSINESS CALENDAR (EMPLOYEE+QM+ADMIN) ---------------- */}
          <Route
            element={
              <RequireAuth
                allowedRoles={[
                  ROLES.employee,
                  ROLES.qm,
                  ROLES.admin,
                  ROLES.salesTeam,
                ]}
              />
            }
          >
            <Route
              path="/dashboard/business-calendar"
              element={<Nav main={[<BusinessCalendarHome />]} />}
            />

            <Route
              path="/dashboard/business-calendar/history"
              element={<Nav main={[<HistoryCalendar />]} />}
            />

            <Route
              path="/dashboard/business-calendar/calendarview"
              element={<Nav main={[<CalendarView />]} />}
            />

            <Route
              path="/dashboard/business-calendar/admin"
              element={<Nav main={[<BusCalAdmin />]} />}
            />
            <Route
              path="/dashboard/settings/details"
              element={<Nav main={[<AccountDetails />]} />} 
              />
          </Route>
          <Route path="/" element={<OkrDashboard />}/>
          <Route path="/okrdashboard" element={<OkrDashboard />} />

          {/* ---------------- OKR TRACKER (EMPLOYEE+QM+ADMIN) ---------------- */}
          <Route
            element={
              <RequireAuth
                allowedRoles={[
                  ROLES.employee,
                  ROLES.qm,
                  ROLES.admin,
                  ROLES.salesTeam,
                ]}
              />
            }
          >
            <Route
              path="/dashboard/okrtracker/objectives"
              element={<ObjectivesPage />}
            />

            <Route
              path="/dashboard/okrtracker/objectives/create"
              element={<Nav main={[<CreateObjectives />]} />}
            />

            <Route
              path="/dashboard/okrtracker/admin/groups"
              element={<Nav main={[<GroupManagement />]} />}
            />

            <Route
              path="/dashboard/okrtracker/admin/roles"
              element={<Nav main={[<RoleManagement />]} />}
            />
          </Route>

          {/* ---------------- ADMIN ONLY ---------------- */}
          <Route
            element={<RequireAuth allowedRoles={[ROLES.admin]} />}
          >
            <Route
              path="/dashboard/settings/manage"
              element={<Nav main={[<ManageAccounts />]} />}
            />

            <Route
              path="/dashboard/settings/qm"
              element={<Nav main={[<QMAccountHeader />]} />}
            />

            <Route
              path="/dashboard/dev-playground"
              element={<Nav main={[<DevPlayground />]} />}
            />
                      
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>

      <ToastContainer />
    </>
  );
}

export default App;