import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Badge from "@mui/material/Badge";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { useNavigate } from "react-router-dom";
import PushNotificationBox from "../../Alert/PushNotificationBox";
import { useNotifications } from "../../../features/settings/notificationContext";

const NotificationHolder = ({ handleClose }) => {
  const navigate = useNavigate();
  const { notifications, loading, markNotificationRead } = useNotifications();

  const displayedNotifications = useMemo(() => {
    return notifications.slice(0, 5);
  }, [notifications]);

  const overflowCount = useMemo(() => {
    const overflow = notifications.length - 5;
    return overflow > 0 ? overflow : 0;
  }, [notifications]);

  const handleNotificationClick = async (notification) => {
    console.log(
      "[NotificationHolder] clicked:",
      notification._id,
      notification.status,
    );

    console.log("Clicked notification link:", notification.link);

    if (!notification?._id) return;

    if (notification.status !== "read") {
      const success = await markNotificationRead(notification._id);
      console.log("[NotificationHolder] mark read success:", success);
    }

    if (handleClose) {
      handleClose();
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <Box
      sx={{
        width: "25vw",
        height: "40vh",
        minHeight: "200px",
        minWidth: "250px",
        padding: 1.5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <Typography variant="h6" gutterBottom>
          Notifications
        </Typography>

        <Box
          sx={{
            fontSize: "0.8em",
            maxHeight: "calc(100% - 70px)",
            overflowY: "auto",
          }}
        >
          {loading ? (
            <Stack spacing={1}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="text"
                  sx={{ fontSize: "1rem" }}
                />
              ))}
            </Stack>
          ) : displayedNotifications.length > 0 ? (
            displayedNotifications.map((notification) => (
              <Box key={notification._id} sx={{ mb: 1 }}>
                <PushNotificationBox
                  message={notification.content}
                  timestamp={notification.timestamp?.created}
                  category={notification.category}
                  link={notification.link}
                  status={notification.status}
                  mode={false}
                  onClick={() => handleNotificationClick(notification)}
                />
              </Box>
            ))
          ) : (
            <Typography variant="body2" sx={{ marginTop: 2 }}>
              No notifications available.
            </Typography>
          )}
        </Box>
      </div>

      <Box sx={{ marginTop: "auto", textAlign: "center" }}>
        <Badge
          color="primary"
          badgeContent={overflowCount > 0 ? "●" : 0}
          invisible={overflowCount === 0}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          <Typography variant="body2">
            <Link
              component="button"
              onClick={() => {
                if (handleClose) {
                  handleClose();
                }

                navigate("/dashboard/notifications");
              }}
              sx={{
                color: "blue",
                textDecoration: "underline",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Open Archive
            </Link>
          </Typography>
        </Badge>
      </Box>
    </Box>
  );
};

export default NotificationHolder;
