import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSelector } from "react-redux";
import notificationService from "./notificationService";
import { getSocket, disconnectSocket } from "../../socket";

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  loading: false,
  markNotificationRead: async () => false,
  addNotification: () => {},
  clearNotifications: () => {},
  refreshNotifications: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useSelector((state) => state.auth);

  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const notificationIdsRef = useRef(new Set());
  const socketRef = useRef(null);

  const chime = useMemo(() => new Audio("/bell.mp3"), []);
  const [canPlaySound, setCanPlaySound] = useState(false);

  useEffect(() => {
    const enableSound = () => {
      setCanPlaySound(true);
      document.removeEventListener("click", enableSound);
    };

    document.addEventListener("click", enableSound);

    return () => {
      document.removeEventListener("click", enableSound);
    };
  }, []);

  const normaliseNotification = useCallback((notification) => {
    return {
      ...notification,
      _id: String(notification._id),
      user: String(notification.user),
      link: notification.link || "",
      status: notification.status || "unread",
      category: notification.category || "general",
      timestamp: {
        created:
          notification.timestamp?.created ||
          notification.createdAt ||
          new Date().toISOString(),
        read: notification.timestamp?.read || null,
      },
    };
  }, []);

  const sortNotifications = useCallback((items) => {
    return [...items].sort(
      (a, b) =>
        new Date(b.timestamp?.created || 0) -
        new Date(a.timestamp?.created || 0)
    );
  }, []);

  const syncNotificationIds = useCallback((items) => {
    notificationIdsRef.current = new Set(
      items.map((item) => String(item._id))
    );
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user?.token) {
      setNotifications([]);
      syncNotificationIds([]);
      return;
    }

    try {
      setLoading(true);

      const data = await notificationService.getUserNotifications(user.token);

      const normalised = (Array.isArray(data) ? data : []).map(
        normaliseNotification
      );

      const sorted = sortNotifications(normalised);

      setNotifications(sorted);
      syncNotificationIds(sorted);
    } catch (error) {
      console.error(
        "[NotificationContext] Failed to fetch notifications:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, [
    user?.token,
    normaliseNotification,
    sortNotifications,
    syncNotificationIds,
  ]);

  const addNotification = useCallback(
    (incomingNotification) => {
      if (!incomingNotification?._id) return;

      const notification = normaliseNotification(incomingNotification);
      const id = String(notification._id);

      setNotifications((prev) => {
        const exists = prev.some((item) => String(item._id) === id);
        if (exists) return prev;

        const updated = sortNotifications([notification, ...prev]);
        notificationIdsRef.current.add(id);

        return updated;
      });

      if (canPlaySound) {
        chime.play().catch(() => {});
      }
    },
    [normaliseNotification, sortNotifications, canPlaySound, chime]
  );

  const markNotificationRead = useCallback(
    async (notificationId) => {
      if (!user?.token || !notificationId) return false;

      const id = String(notificationId);

      // Optimistic UI update:
      // immediately update the notification as read so badge count decreases
      // and notification row colour changes without waiting for API response.
      setNotifications((prev) =>
        prev.map((item) =>
          String(item._id) === id
            ? {
                ...item,
                status: "read",
                timestamp: {
                  ...item.timestamp,
                  read: item.timestamp?.read || new Date().toISOString(),
                },
              }
            : item
        )
      );

      try {
        const updated = await notificationService.updateNotificationStatus(
          notificationId,
          user.token
        );

        // Sync local state with backend response.
        setNotifications((prev) =>
          prev.map((item) =>
            String(item._id) === id
              ? {
                  ...item,
                  status: updated?.status || "read",
                  timestamp: {
                    ...item.timestamp,
                    read:
                      updated?.timestamp?.read ||
                      updated?.updatedAt ||
                      new Date().toISOString(),
                  },
                }
              : item
          )
        );

        return true;
      } catch (error) {
        console.error(
          "[NotificationContext] Failed to mark notification read:",
          error
        );

        // Revert UI if backend update failed.
        setNotifications((prev) =>
          prev.map((item) =>
            String(item._id) === id
              ? {
                  ...item,
                  status: "unread",
                  timestamp: {
                    ...item.timestamp,
                    read: null,
                  },
                }
              : item
          )
        );

        return false;
      }
    },
    [user?.token]
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    syncNotificationIds([]);
  }, [syncNotificationIds]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user?.token) {
      setIsConnected(false);
      // Only disconnect when user logs out (no token)
      disconnectSocket();
      return;
    }

    const socket = getSocket(user.token);
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      console.log("[NotificationContext] Socket connected:", socket.id);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log("[NotificationContext] Socket disconnected");
    };

    const handleConnectError = (error) => {
      setIsConnected(false);
      console.error("[NotificationContext] Socket connection error:", error);
    };

    const handleNewNotification = (notification) => {
      console.log(
        "[NotificationContext] New real-time notification received:",
        notification
      );

      addNotification(notification);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("notification:new", handleNewNotification);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("notification:new", handleNewNotification);
      // Don't disconnect the singleton socket - just remove listeners
      // Socket will stay connected for other components and contexts
    };
  }, [user?.token, addNotification]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => item.status === "unread").length;
  }, [notifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isConnected,
      loading,
      markNotificationRead,
      addNotification,
      clearNotifications,
      refreshNotifications,
    }),
    [
      notifications,
      unreadCount,
      isConnected,
      loading,
      markNotificationRead,
      addNotification,
      clearNotifications,
      refreshNotifications,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};