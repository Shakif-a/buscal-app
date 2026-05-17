const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Please add content for the notification"],
    },
    link: {
      type: String,
    },
    status: {
      type: String,
      enum: ["unread", "read", "sent"],
      default: "unread",
      required: true,
    },
    channel: {
      type: String,
      enum: ["web", "email", "sms"],
      required: true,
    },
    timestamp: {
      created: {
        type: Date,
        default: Date.now,
      },
      read: {
        type: Date,
      },
    },
    category: {
      type: String,
      required: [true, "Please add a category for the notification"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
