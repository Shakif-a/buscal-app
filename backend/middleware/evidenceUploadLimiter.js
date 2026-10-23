const uploadsByUser = new Map();

const maximumUploads = 30;
const windowMilliseconds = 5 * 60 * 1000;

function removeExpiredUploads(now) {
  for (const [userId, timestamps] of uploadsByUser) {
    const activeTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < windowMilliseconds,
    );

    if (activeTimestamps.length === 0) {
      uploadsByUser.delete(userId);
    } else {
      uploadsByUser.set(userId, activeTimestamps);
    }
  }
}

function evidenceUploadLimiter(req, res, next) {
  const userId = req.user && req.user._id ? req.user._id.toString() : req.ip;
  const now = Date.now();

  removeExpiredUploads(now);
  const timestamps = uploadsByUser.get(userId) || [];

  if (timestamps.length >= maximumUploads) {
    const waitMilliseconds = windowMilliseconds - (now - timestamps[0]);
    res.set("Retry-After", String(Math.ceil(waitMilliseconds / 1000)));
    res.status(429);
    throw new Error(
      "Too many evidence uploads in a short time. Please wait a few minutes and try again.",
    );
  }

  timestamps.push(now);
  uploadsByUser.set(userId, timestamps);
  next();
}

module.exports = { evidenceUploadLimiter };
