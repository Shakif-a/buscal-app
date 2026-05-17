const { emitToUser } = require("../config/socket");

const notificationQueue = [];


/**
 * Push a notification immediately via Socket.IO.
 * Returns a success/error object to preserve the old flow.
 */
const pushNotification = (notificationData) => {
  try {
    if (!notificationData) {
      return { success: false, error: "Notification data is required" };
    }

    if (!notificationData.user) {
      return { success: false, error: "User ID is required" };
    }

    const payload = {
      _id: String(notificationData._id),
      user: String(notificationData.user),
      content: notificationData.content,
      category: notificationData.category,
      link: notificationData.link || "",
      status: notificationData.status || "unread",
      timestamp: {
        created:
          notificationData.timestamp?.created || new Date().toISOString(),
        read: notificationData.timestamp?.read || null,
      },
    };

    emitToUser(String(notificationData.user), "notification:new", payload);

    return { success: true };
  } catch (error) {
    console.error("[WEB SERVICE] Failed to emit notification:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Keep the same function name so existing code paths continue to work.
 * For WebSocket-based delivery, enqueue can emit immediately.
 */
const enqueueNotification = (notificationData) => {
  return pushNotification(notificationData);
};

/**
 * Compatibility function.
 * If you later decide to truly queue notifications, this can be expanded.
 * For now it preserves the API without changing existing callers.
 */
const processQueue = async () => {
  while (notificationQueue.length > 0) {
    const notification = notificationQueue.shift();
    pushNotification(notification);
  }
};

/**
 * Compatibility helper retained so anything importing it does not break.
 * With room-based Socket.IO delivery, active connection count is not tracked here.
 */
const getActiveConnectionCount = (_userId) => {
  return 0;
};

module.exports = {
  pushNotification,
  enqueueNotification,
  processQueue,
  getActiveConnectionCount,
};