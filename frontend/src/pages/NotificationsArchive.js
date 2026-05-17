import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import PushNotificationBox from "../components/Alert/PushNotificationBox";
import notificationService from "../features/settings/notificationService";

const NotificationsArchive = () => {
  const [notifications, setNotifications] = useState([]);
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const observerRef = useRef(null);
  const visibilityMapRef = useRef(new Map());
  const processedIdsRef = useRef(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!user?.token) return;

    try {
      const allUserNotif = await notificationService.getUserNotifications(
        user.token
      );

      setNotifications(Array.isArray(allUserNotif) ? allUserNotif : []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setNotifications([]);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markArchiveNotificationRead = useCallback(
    async (notificationId) => {
      if (!notificationId || !user?.token) return false;

      try {
        await notificationService.updateNotificationStatus(
          notificationId,
          user.token
        );

        setNotifications((prev) =>
          prev.map((item) =>
            String(item._id) === String(notificationId)
              ? {
                  ...item,
                  status: "read",
                  timestamp: {
                    ...item.timestamp,
                    read:
                      item.timestamp?.read ||
                      new Date().toISOString(),
                  },
                }
              : item
          )
        );

        processedIdsRef.current.add(notificationId);
        return true;
      } catch (error) {
        console.error(
          `Failed to update status for notification ${notificationId}:`,
          error
        );
        return false;
      }
    },
    [user?.token]
  );

  const handleNotificationClick = useCallback(
    async (notification) => {
      if (!notification?._id) return;

      console.log("Archive clicked notification link:", notification.link);

      if (notification.status !== "read") {
        await markArchiveNotificationRead(notification._id);
      }

      if (notification.link) {
        navigate(notification.link);
      }
    },
    [markArchiveNotificationRead, navigate]
  );

  useEffect(() => {
    const updateVisibleNotificationsStatus = async (visibleNotificationIds) => {
      if (!user?.token) return;

      for (const id of visibleNotificationIds) {
        if (processedIdsRef.current.has(id)) continue;

        const notification = notifications.find(
          (notif) => String(notif._id) === String(id)
        );

        if (!notification) continue;

        if (notification.status === "read") {
          processedIdsRef.current.add(id);
          continue;
        }

        await markArchiveNotificationRead(id);
      }
    };

    const updateVisibilityStats = () => {
      const visibleNotificationIds = Array.from(
        visibilityMapRef.current.entries()
      )
        .filter(([_, isVisible]) => isVisible)
        .map(([id]) => id);

      updateVisibleNotificationsStatus(visibleNotificationIds);
    };

    const handleIntersect = (entries) => {
      entries.forEach((entry) => {
        const notificationId = entry.target.dataset.notificationId;
        visibilityMapRef.current.set(notificationId, entry.isIntersecting);
      });

      updateVisibilityStats();
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold: 0,
      rootMargin: "0px",
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [user?.token, notifications, markArchiveNotificationRead]);

  useEffect(() => {
    if (!observerRef.current) return;

    visibilityMapRef.current.clear();

    const notificationElements = document.querySelectorAll(".notification-box");

    notificationElements.forEach((element) => {
      observerRef.current.observe(element);
    });

    return () => {
      notificationElements.forEach((element) => {
        observerRef.current?.unobserve(element);
      });
    };
  }, [notifications]);

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Your Notifications
      </Typography>

      {Array.isArray(notifications) && notifications.length > 0 ? (
        notifications.map((notification) => (
          <Box
            key={notification._id}
            className="notification-box"
            data-notification-id={notification._id}
            sx={{ mb: 1 }}
          >
            <PushNotificationBox
              message={notification.content}
              timestamp={notification.timestamp?.created}
              category={notification.category}
              link={notification.link}
              status={notification.status}
              onClick={() => handleNotificationClick(notification)}
            />
          </Box>
        ))
      ) : (
        <Typography variant="body1">No notifications available.</Typography>
      )}
    </Box>
  );
};

export default NotificationsArchive;