const fs = require("fs").promises;
const path = require("path");

/**
 * Generates an ICS (iCalendar) file for Outlook calendar integration
 * @param {Object} eventDetails - Event information
 * @param {string} eventDetails.title - Event title
 * @param {Date} eventDetails.startDate - Event start date
 * @param {Date} eventDetails.endDate - Event end date
 * @param {string} eventDetails.description - Event description
 * @param {string} eventDetails.location - Event location (optional)
 * @param {string} organizerEmail - Organizer's email address
 * @returns {Promise<string>} - Path to the generated ICS file
 */
async function generateICSFile(eventDetails, organizerEmail) {
  const {
    title,
    startDate,
    endDate,
    description = "",
    location = "",
  } = eventDetails;

  // Format dates for ICS (YYYYMMDDTHHMMSSZ format in UTC)
  const formatICSDate = (date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  };

  // Generate unique UID for the event
  const uid = `${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}@micromaxdashboard.com`;

  // Current timestamp for DTSTAMP
  const now = new Date();
  const dtstamp = formatICSDate(now);

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Micromax Dashboard//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    location ? `LOCATION:${location}` : "",
    `ORGANIZER:MAILTO:${organizerEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((line) => line !== "")
    .join("\r\n");

  // Create temporary file
  const fileName = `event-${Date.now()}.ics`;
  const filePath = path.join(__dirname, "temp", fileName);

  // Ensure temp directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write ICS file
  await fs.writeFile(filePath, icsContent, "utf8");

  return filePath;
}

/**
 * Generates Outlook calendar link (alternative to ICS file)
 * @param {Object} eventDetails - Event information
 * @returns {string} - Outlook calendar URL
 */
function generateOutlookLink(eventDetails) {
  const {
    title,
    startDate,
    endDate,
    description = "",
    location = "",
  } = eventDetails;

  // Format dates for Outlook URL (ISO format)
  const startTime = startDate
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const endTime = endDate
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const params = new URLSearchParams({
    subject: title,
    startdt: startTime,
    enddt: endTime,
    body: description,
    location: location,
    allday: false,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Cleans up temporary ICS files
 * @param {string} filePath - Path to the ICS file to delete
 */
async function cleanupICSFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`Cleaned up temporary file: ${filePath}`);
  } catch (error) {
    console.warn(`Could not clean up file ${filePath}:`, error.message);
  }
}

module.exports = {
  generateICSFile,
  generateOutlookLink,
  cleanupICSFile,
};
