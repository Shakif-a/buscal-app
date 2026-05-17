import axios from "axios";

// Change VITE_API_URL in your .env if needed.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Fetch all saved notifications for the logged-in user.
 * This is NOT real-time.
 * This is just the initial API fetch from backend database.
 */
const getUserNotifications = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(
    `${API_URL}/api/notify/user-notifications`,
    config,
  );

  return response.data.notifications || [];
};

/**
 * Mark one notification as read in backend.
 * After backend updates DB, frontend also updates local state.
 */

const updateNotificationStatus = async (notificationId, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.patch(
    `${API_URL}/api/notify/${notificationId}/status`,
    {},
    config,
  );

  return response.data.notification;
};

const notificationService = {
  getUserNotifications,
  updateNotificationStatus,
};

export default notificationService;
