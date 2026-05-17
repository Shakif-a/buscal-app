/*
notificationController.js

This file handles notification-related operations, including fetching, updating, creating,
and sending notifications across multiple channels (web, email, SMS). It also includes helper
functions for updating statuses and enqueuing notifications for delivery.

Functions:
- convertFileIdsToAttachments: Converts file IDs to email attachment objects.
- getUserNotifications: Fetches all notifications for a specific user, sorted by creation time.
- updateNotificationStatus: Updates the status of a specific notification to "read."
- updateEmailSmsStatus: Updates the status of multiple notifications to "sent."
- createNotification: Creates notifications for multiple users across multiple channels.
- pushNotification: Handles sending a web notification for a single user.
- sendWebNotification: Enqueues a web notification for delivery via webService.
- testCreateNotification: Handles creation and processing of notifications from input data.
- generateNotifications: Generates notifications and manages email/SMS status updates.
- sendEmailNotifications: Sends email notifications for specific notification IDs.
- sendEmail: Sends a direct email to specified recipients using the email service.
*/

const Notification = require("../models/notificationModel");
const File = require("../models/filesModel");
const path = require("path");
const fs = require("fs");
const webService = require("../services/webService");
const sendEmailService = require("../services/emailService");
const { getUploadedFilePath } = require("../config/uploadPaths");

/**
 * Converts file IDs to email attachment objects
 * @param {Array} fileIds - Array of MongoDB file IDs
 * @returns {Array} Array of attachment objects for Nodemailer
 */
async function convertFileIdsToAttachments(fileIds) {
  if (!fileIds || !Array.isArray(fileIds)) return [];

  const attachments = [];

  for (const fileId of fileIds) {
    try {
      const file = await File.findById(fileId);
      if (!file) {
        console.warn(`File not found for ID: ${fileId}`);
        continue;
      }

      const filePath = getUploadedFilePath(file.datafilename);

      if (!fs.existsSync(filePath)) {
        console.warn(`File not found on server: ${filePath}`);
        continue;
      }

      attachments.push({
        filename: file.filename,
        path: filePath,
      });
    } catch (error) {
      console.error(`Error processing file ${fileId}:`, error.message);
    }
  }

  return attachments;
}

/**
 * Prepares calendar event data for Outlook/ICS integration
 * @param {Object} additionalObject - Object containing calendar data
 * @returns {Object|null} Event details object or null if insufficient data
 */
function prepareCalendarEventData(additionalObject) {
  if (!additionalObject.title || !additionalObject.endTime) {
    return null;
  }

  let startTime = additionalObject.startTime;

  if (!startTime) {
    const endDate = new Date(additionalObject.endTime);
    startTime = new Date(endDate.getTime() - 60 * 60 * 1000);
  }

  return {
    title: additionalObject.title,
    startDate: new Date(startTime),
    endDate: new Date(additionalObject.endTime),
    description: additionalObject.description || "",
    location: additionalObject.notes || "",
  };
}

/**
 * Function to fetch all notifications for a specific user.
 * @param {Object} req - Express request object (with user._id)
 * @param {Object} res - Express response object
 */
const getUserNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const notifications = await Notification.find({
      user: req.user._id,
      channel: "web",
    })
      .sort({ "timestamp.created": -1 })
      .exec();

    res.status(200).json({ notifications });
  } catch (error) {
    console.error("Error fetching user notifications:", error.message);
    res.status(500).json({ message: "Error fetching notifications.", error });
  }
};

/**
 * Function to update the status of a specific notification to "read".
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateNotificationStatus = async (req, res) => {
  try {
    const notificationId = req.params.id || req.body.notificationId;

    if (!notificationId) {
      return res.status(400).json({
        message: "Notification ID is required.",
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        message: "User not authenticated.",
      });
    }

    // Debug logs
    console.log("[MARK READ] notificationId:", notificationId);
    console.log("[MARK READ] req.user._id:", req.user._id);

    const updatedNotification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user: req.user._id,
      },
      {
        $set: {
          status: "read",
          "timestamp.read": new Date(),
        },
      },
      { new: true },
    );

    console.log("[MARK READ] updatedNotification:", updatedNotification);

    if (!updatedNotification) {
      return res.status(404).json({
        message: "Notification not found or not authorised.",
      });
    }

    res.status(200).json({
      message: "Notification status updated successfully.",
      notification: updatedNotification,
    });
  } catch (error) {
    console.error("Error updating notification status:", error.message);

    res.status(500).json({
      message: "Error updating notification status.",
      error,
    });
  }
};

/**
 * Function to update the status of specific notifications to "sent".
 * @param {Array} notificationIds - Array of notification ObjectIds to update.
 * @returns {Promise<Object>} - MongoDB update result.
 */
const updateEmailSmsStatus = async (notificationIds) => {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new Error(
      "The 'notificationIds' parameter must be a non-empty array.",
    );
  }

  try {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $set: { status: "sent", "timestamp.read": Date.now() } },
    );
    console.log("Updated notifications status to 'sent':", result);
    return result;
  } catch (error) {
    console.error("Error updating notification statuses:", error.message);
    throw new Error("Failed to update notification statuses.");
  }
};

/**
 * Function to create notifications for multiple users across multiple channels.
 * @param {Array} users - Array of user ObjectIds
 * @param {String} content - Notification content (HTML or plain text)
 * @param {Array} channels - Array of strings (e.g., ['web', 'email', 'sms'])
 * @param {String} category - Category of the notification
 * @param {String} link - Click the notification to go to this link
 * @returns {Promise<Array>} - Array of created notification documents
 */
const createNotification = async (users, content, channels, link, category) => {
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

  const notifications = [];

  for (const user of users) {
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

  const createdNotifications = await Notification.insertMany(notifications);
  return createdNotifications;
};

/**
 * Function to handle sending push notifications (Request-Response handler).
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const pushNotification = async (req, res) => {
  try {
    const { content, user, category, link } = req.body;

    if (!user) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!content) {
      return res
        .status(400)
        .json({ error: "Notification content is required" });
    }

    const createdNotifications = await createNotification(
      [user],
      content,
      ["web"],
      link || null,
      category || "general",
    );

    const notificationData = createdNotifications[0];

    sendWebNotification(notificationData);

    res.status(200).json({
      success: true,
      message: "Notification enqueued for delivery",
      notification: {
        _id: notificationData._id.toString(),
        user: notificationData.user.toString(),
        content: notificationData.content,
        category: notificationData.category,
        link: notificationData.link,
        status: notificationData.status || "unread",
        timestamp: {
          created:
            notificationData.timestamp?.created || new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Error in pushNotification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
};

/**
 * Function to enqueue web notifications for delivery.
 * @param {Object} notificationData - Notification object to enqueue.
 */
const sendWebNotification = (notificationData) => {
  try {
    const webNotification = {
      _id: notificationData._id.toString(),
      user: notificationData.user.toString(),
      content: notificationData.content,
      category: notificationData.category,
      link: notificationData.link,
      status: notificationData.status || "unread",
      timestamp: {
        created:
          notificationData.timestamp?.created || new Date().toISOString(),
        read: notificationData.timestamp?.read || null,
      },
    };

    webService.enqueueNotification(webNotification);
  } catch (error) {
    console.error("Error in sendWebNotification:", error);
    throw error;
  }
};

/**
 * Function to handle creating notifications from req.body input.
 * Calls the generateNotifications function with input parameters.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testCreateNotification = async (req, res) => {
  try {
    const { users, content, channels, category, link } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: "Users array is required." });
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ message: "Channels array is required." });
    }
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ message: "Content is required." });
    }
    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ message: "Category is required." });
    }

    await generateNotifications(users, content, channels, category, link);

    res.status(200).json({
      success: true,
      message: "Notifications created and processed successfully.",
    });
  } catch (error) {
    console.error("Error in testCreateNotification:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create and process notifications.",
      error: error.message,
    });
  }
};

/**
 * Generate notifications and handle email/sms status updates.
 * @param {Array} users - Array of user ObjectIds.
 * @param {String} content - Notification content (HTML or plain text).
 * @param {Array} channels - Array of strings (e.g., ['web', 'email', 'sms']).
 * @param {String} category - Category of the notification.
 * @param {String} link - URL to redirect to when notification is clicked.
 */
const generateNotifications = async (
  users,
  content,
  channels,
  category,
  link,
  additionalObject = {},
) => {
  try {
    let updatedContent = content;

    if (additionalObject.description) {
      updatedContent += `<p><strong>Description:</strong> ${additionalObject.description}</p>`;
    }

    if (additionalObject.notes) {
      updatedContent += `<p><strong>Notes:</strong> ${additionalObject.notes}</p>`;
    }

    let calendarEventData = null;
    let shouldAddCalendar = false;

    if (additionalObject.title && additionalObject.endTime) {
      calendarEventData = prepareCalendarEventData(additionalObject);
      if (calendarEventData) {
        shouldAddCalendar = true;
      }
    }

    let attachments = [];
    if (additionalObject.file && Array.isArray(additionalObject.file)) {
      attachments = await convertFileIdsToAttachments(additionalObject.file);
    }

    const createdNotifications = await createNotification(
      users,
      updatedContent,
      channels,
      link,
      category,
    );

    const webIds = [];
    const emailIds = [];
    const smsIds = [];

    createdNotifications.forEach((notification) => {
      if (notification.channel === "web") webIds.push(notification);
      if (notification.channel === "email") emailIds.push(notification._id);
      if (notification.channel === "sms") smsIds.push(notification._id);
    });

    if (webIds.length > 0) {
      webIds.forEach(sendWebNotification);
    }

    if (emailIds.length > 0) {
      const successfulEmailIds = await sendEmailNotifications(
        emailIds,
        attachments,
        shouldAddCalendar,
        calendarEventData,
      );

      if (successfulEmailIds.length > 0) {
        await updateEmailSmsStatus(successfulEmailIds);
      }
    }
  } catch (error) {
    console.error("Error in generateNotifications:", error.message);
    throw error;
  }
};

/**
 * Function to send email notifications based on notification IDs.
 * @param {Array} emailIds - Array of notification ObjectIds
 */
const sendEmailNotifications = async (
  emailIds,
  attachments = [],
  shouldAddCalendar = false,
  calendarEventData = null,
) => {
  const successfulIds = [];
  const failedIds = [];

  try {
    const notifications = await Notification.find({
      _id: { $in: emailIds },
    }).populate("user", "email");

    if (!notifications || notifications.length === 0) {
      throw new Error("No notifications found for email sending.");
    }

    for (const notification of notifications) {
      try {
        const recipientEmail = notification.user.email;

        if (!recipientEmail) {
          console.warn(`No email found for user ${notification.user._id}`);
          failedIds.push(notification._id);
          continue;
        }

        let subject;
        switch (notification.category) {
          case "cia":
            subject = "MMX Continuous Improvement Action Reporting";
            break;
          case "vms":
            subject = "MMX Visitor Management System";
            break;
          case "calendar":
            subject = "MMX Business Calendar";
            break;
          case "newsletter":
            subject = "MMX Newsletter Notification";
            break;
          default:
            subject = "MMX Dashboard";
        }

        let body = notification.content;

        if (notification.link && typeof notification.link === "string") {
          const fullLink = `https://dashboard.int.micromax.com.au${notification.link}`;
          body += `<br><br><a href="${fullLink}">View Details</a>`;
        }

        const result = await sendEmailService(
          [recipientEmail],
          subject,
          body,
          attachments,
          shouldAddCalendar,
          calendarEventData,
        );

        if (result.successCount > 0) {
          successfulIds.push(notification._id);
        } else {
          const failure = result.failures.find(
            (f) => f.recipient === recipientEmail,
          );
          console.error(
            `Failed to send email to ${recipientEmail} for notification ${notification._id}:`,
            failure?.error || "Unknown error",
          );
          failedIds.push(notification._id);
        }
      } catch (error) {
        console.error(
          `Error processing notification ${notification._id}:`,
          error.message,
        );
        failedIds.push(notification._id);
      }
    }

    console.log("Email notifications sent. Successful IDs:", successfulIds);
    console.log("Failed email IDs:", failedIds);

    return successfulIds;
  } catch (error) {
    console.error("Error in sendEmailNotifications:", error.message);
    throw new Error("Failed to send email notifications.");
  }
};

/**
 * Function to handle sending an email.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendEmail = async (req, res) => {
  const { recipients, subject, body, attachments } = req.body;

  if (!recipients || !subject || !body) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    console.log(
      `Sending email with subject "${subject}" to recipients: ${recipients.join(
        ", ",
      )}`,
    );

    const result = await sendEmailService(
      recipients,
      subject,
      body,
      attachments || [],
    );

    if (result.failureCount > 0) {
      return res.status(207).json({
        message: "Email sent with some failures.",
        details: result.failures,
      });
    }

    res.status(200).json({ message: "Emails sent successfully.", result });
  } catch (error) {
    console.error("Error in sendEmail:", error.message);
    res.status(500).json({ error: "Failed to send email." });
  }
};

module.exports = {
  getUserNotifications,
  updateNotificationStatus,
  generateNotifications,
  createNotification,
  pushNotification,
  testCreateNotification,
  sendEmail,
};
