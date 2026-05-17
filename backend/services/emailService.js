const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const User = require("../models/userModel");
const { generateICSFile } = require("./outlookService");

// Load environment variables from .env file
dotenv.config();

/**
 * Extracts a capitalised name from an email address by querying MongoDB User collection.
 *
 * @param {string} email - The recipient's email address.
 * @returns {Promise<string>} Capitalised name extracted from the database or email.
 */
async function extractNameFromEmail(email) {
  if (!email || typeof email !== "string") {
    return "User";
  }

  // Special case
  if (email.startsWith("cia-")) {
    return "QM";
  }

  try {
    const user = await User.findOne({ email }).lean();

    if (user && user.firstName) {
      return user.firstName;
    }
  } catch (error) {
    console.warn(`Error querying user by email ${email}:`, error.message);
  }

  // Fallback: use the local part of the email address
  const name = email.split("@")[0];
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * SMTP transporter using credentials from .env.
 */
const defaultTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Sends an email to multiple recipients with optional calendar integration.
 *
 * @param {string[]} recipients - Array of recipient email addresses.
 * @param {string} subject - Subject of the email.
 * @param {string} body - Email body (plain text or HTML).
 * @param {Array} attachments - Array of email attachments.
 * @param {boolean} addToOutlook - Whether to attach an ICS calendar file.
 * @param {Object|null} eventDetails - Event details used to generate the ICS file.
 * @returns {Promise<object>} Summary of send results.
 */
async function sendEmail(
  recipients,
  subject,
  body,
  attachments = [],
  addToOutlook = false,
  eventDetails = null,
) {
  let successCount = 0;
  let failureCount = 0;
  const failureList = [];
  let icsFilePath = null;

  const fromAddress = process.env.EMAIL_ADDRESS;

  // Generate and attach ICS file if requested
  if (addToOutlook && eventDetails) {
    try {
      icsFilePath = await generateICSFile(eventDetails, fromAddress);

      attachments = [
        ...attachments,
        {
          filename: "event.ics",
          path: icsFilePath,
          contentType: "text/calendar",
        },
      ];
    } catch (error) {
      console.error("Error generating calendar data:", error.message);
      // Continue without calendar attachment
    }
  }

  // Send emails one-by-one so each recipient receives an individual email
  for (const recipient of recipients) {
    // Skip invalid recipients
    if (
      !recipient ||
      typeof recipient !== "string" ||
      !recipient.trim()
    ) {
      console.warn(`Skipping invalid recipient: ${recipient}`);
      continue;
    }

    const name = await extractNameFromEmail(recipient);

    // Avoid duplicating greeting/signature if already present
    let personalisedBody;
    if (
      !body.includes("Hello") &&
      !body.includes("Dear") &&
      !body.includes("Micromax Dashboard")
    ) {
      personalisedBody =
        `\nHello ${name},\n\n${body}\n\nMicromax Dashboard\n`;
    } else {
      personalisedBody = body;
    }

    const mailOptions = {
      from: fromAddress,
      to: recipient,
      subject,
      text: personalisedBody.replace(/<[^>]*>/g, ""),
      html: personalisedBody.replace(/\n/g, "<br>"),
      attachments,
    };

    try {
      const info = await defaultTransporter.sendMail(mailOptions);

      console.log(
        `Message sent to ${recipient}: ${info.messageId}`,
      );

      successCount++;
    } catch (error) {
      console.error(
        `Error sending email to ${recipient}:`,
        error.message,
      );

      failureCount++;

      failureList.push({
        recipient,
        error: error.message,
        errorType: error.code || "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Clean up temporary ICS file
  if (icsFilePath) {
    try {
      const { cleanupICSFile } = require("./outlookService");
      await cleanupICSFile(icsFilePath);
    } catch (error) {
      console.warn("Error cleaning up ICS file:", error.message);
    }
  }

  // Log summary
  console.log(`Emails sent: ${successCount}`);
  console.log(`Failures: ${failureCount}`);

  if (failureList.length > 0) {
    console.log("Failed recipients:", failureList);
  }

  // Return detailed results
  return {
    successCount,
    failureCount,
    failures: failureList,
  };
}

module.exports = sendEmail;