import { useLocation, Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useSelector } from "react-redux";

const RequireAuth = ({ allowedRoles }) => {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const currentUrl = window.location.pathname;

  useEffect(() => {
    localStorage.setItem("errorURL", JSON.stringify(currentUrl));
  }, [currentUrl]);

  // Check if user exists and has any of the allowed roles
  const hasAllowedRole = user?.roles?.some((role) =>
    allowedRoles?.includes(role)
  );

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAllowedRole) {
    return <Navigate to="/forbidden" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
