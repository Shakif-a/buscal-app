import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Popover from "@mui/material/Popover";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { Badge } from "@mui/material";
import { useNotifications } from "../../../features/settings/notificationContext";
import NotificationHolder from "./NotificationHolder";

export default function MenuNotifications() {
  const [anchorEl, setAnchorEl] = React.useState(null);
  // Centralized unread count from NotificationContext
  const { unreadCount } = useNotifications();

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <React.Fragment>
      <Box sx={{ display: "flex", alignItems: "center", textAlign: "center" }}>
        <Tooltip title="Notifications">
          <IconButton
            onClick={handleClick}
            color="inherit"
            size="small"
            sx={{ ml: 2 }}
            aria-controls={open ? "notification-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            className="notificationsIcon"
          >
            <Badge badgeContent={unreadCount} color="secondary">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>

      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <NotificationHolder visible={open} handleClose={handleClose} />
      </Popover>

    </React.Fragment>
  );
}