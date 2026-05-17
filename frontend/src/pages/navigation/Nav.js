/**
 * Nav.js — Business Calendar standalone repo
 *
 * Trimmed version of the monorepo Nav.js.
 * All CIA / allSlice dependencies have been removed.
 * Only Business Calendar and Settings appear in the drawer.
 */

import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Icon } from "@iconify/react";

import DashboardIcon from "@mui/icons-material/Dashboard";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SettingsIcon from "@mui/icons-material/Settings";

import Navigation from "../../components/Navigation/Navigation";

const NAVIGATION_CONFIG = {
  brand: {
    image: "/images/logo.png",
    width: 110,
  },
  "brand-mobile": {
    image: "/images/logo.png",
    width: 110,
  },
  settings: ["Settings", "Logout"],
  settingsLink: ["/dashboard/settings", "/logout"],
  avatar:
    "https://media.istockphoto.com/photos/businessman-silhouette-as-avatar-or-default-profile-picture-picture-id476085198?b=1&k=20&m=476085198&s=612x612&w=0&h=Ov2YWXw93vRJNKFtkoFjnVzjy_22VcLLXZIcAO25As4=",
};

const NAVIGATION_ITEMS = [
  {
    name: "Dashboard",
    route: "/dashboard",
    icon: DashboardIcon,
    roles: ["employee", "admin", "qm"],
  },
  {
    name: "Business Calendar",
    route: "/dashboard/business-calendar",
    icon: "material-symbols:calendar-add-on-sharp",
    roles: ["employee", "admin", "qm"],
    iconSize: "text-2xl",
  },

  // Add OKR nav item here when ready:
  // {
  //   name: "OKR",
  //   route: "/dashboard/okr",
  //   icon: "material-symbols:target",
  //   roles: ["employee", "admin", "qm"],
  //   iconSize: "text-2xl",
  // },

  {
    name: "Settings",
    route: "/dashboard/settings",
    icon: SettingsIcon,
    roles: ["employee", "admin", "qm"],
  },
  {
    name: "Logout",
    route: "/logout",
    icon: ExitToAppIcon,
    roles: ["employee", "admin", "qm"],
  },
];

export default function Nav({ main }) {
  const { user } = useSelector((state) => state.auth);

  const filteredItems = useMemo(() => {
    if (!user?.roles || !Array.isArray(user.roles)) {
      return [];
    }

    return NAVIGATION_ITEMS.filter((item) =>
      item.roles.some((role) => user.roles.includes(role)),
    );
  }, [user?.roles]);

  const navigationContent = useMemo(() => {
    const classes = {
      icon: "text-gray-400",
    };

    return {
      ...NAVIGATION_CONFIG,

      name: filteredItems.map((item) => item.name),
      route: filteredItems.map((item) => item.route),

      icon: filteredItems.map((item) => {
        const IconComponent = item.icon;
        const iconClass =
          `${classes.icon} ${item.iconSize || ""}`.trim();

        if (typeof IconComponent === "string") {
          return (
            <Icon
              icon={IconComponent}
              className={iconClass}
            />
          );
        }

        return <IconComponent className={iconClass} />;
      }),

      notifications: [],
      notificationsLink: [],
      notificationsIcon: [],
    };
  }, [filteredItems]);

  return (
    <Navigation
      content={navigationContent}
      bucketMain={main}
    />
  );
}