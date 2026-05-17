const Notification = require("../models/notificationModel");
const { emitToUser } = require("../config/socket");

const mapNotificationForClient = (notificationDoc) => {
  return {
    _id: notificationDoc._id.toString(),
    user: notificationDoc.user.toString(),
    content: notificationDoc.content,
    link: notificationDoc.link || "",
    status: notificationDoc.status || "unread",
    channel: notificationDoc.channel,
    category: notificationDoc.category,
    timestamp: {
      created:
        notificationDoc.timestamp?.created ||
        notificationDoc.createdAt ||
        new Date().toISOString(),
      read: notificationDoc.timestamp?.read || null,
    },
    createdAt: notificationDoc.createdAt || null,
    updatedAt: notificationDoc.updatedAt || null,
  };
};

const createNotificationRecords = async (
  users,
  content,
  channels,
  link,
  category
) => {
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("The 'users' parameter must be a non-empty array.");
  }

  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error("The 'channels' parameter must be a non-empty array.");
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The 'content' parameter must be a non-empty string.");
  }

  if (typeof category !== "string" || !category.trim()) {
    throw new Error("The 'category' parameter must be a non-empty string.");
  }

  const uniqueUsers = [...new Set(users.map((u) => String(u)).filter(Boolean))];

  const notifications = [];

  for (const user of uniqueUsers) {
    for (const channel of channels) {
      notifications.push({
        user,
        content,
        channel,
        link,
        category,
      });
    }
  }

  return Notification.insertMany(notifications);
};

const emitWebNotification = (notificationDoc) => {
  const payload = mapNotificationForClient(notificationDoc);
  emitToUser(payload.user, "notification:new", payload);
  return payload;
};

const createAndEmitNotifications = async (
  users,
  content,
  channels,
  link,
  category
) => {
  const createdNotifications = await createNotificationRecords(
    users,
    content,
    channels,
    link,
    category
  );

  createdNotifications
    .filter((notification) => notification.channel === "web")
    .forEach((notification) => {
      emitWebNotification(notification);
    });

  return createdNotifications;
};

module.exports = {
  mapNotificationForClient,
  createNotificationRecords,
  emitWebNotification,
  createAndEmitNotifications,
};