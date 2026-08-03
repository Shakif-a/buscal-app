const { CircuitBreaker } = require("./circuitBreaker");
const CalendarEntry = require("../models/calendarEntryModel");
const audit = require("./okrAuditService");

// Talks to the Maxbox calendar, falling back to the local copy when it is down.
const breaker = new CircuitBreaker({
  name: "maxbox-calendar",
  failureThreshold: Number(process.env.MAXBOX_FAILURE_THRESHOLD || 3),
  cooldownMs: Number(process.env.MAXBOX_COOLDOWN_MS || 30000),
  timeoutMs: Number(process.env.MAXBOX_TIMEOUT_MS || 5000),
});

// Writes waiting for the Maxbox to come back. Held in memory only.
const pendingWrites = [];

function baseUrl() {
  return process.env.MAXBOX_CALENDAR_URL || "";
}

function isRemoteConfigured() {
  return baseUrl().length > 0;
}

// Fetches entries from the Maxbox, only called when a remote URL is configured.
async function fetchRemoteEntries(ids) {
  const url = `${baseUrl().replace(/\/$/, "")}/api/entries?ids=${ids.join(",")}`;
  const response = await fetch(url, {
    headers: process.env.MAXBOX_API_KEY
      ? { Authorization: `Bearer ${process.env.MAXBOX_API_KEY}` }
      : {},
  });
  if (!response.ok) {
    throw new Error(`Maxbox responded ${response.status}`);
  }
  return response.json();
}

// Reads the local copy, used as the fallback when the Maxbox is unreachable.
async function readLocalEntries(ids) {
  return CalendarEntry.find({ _id: { $in: ids } });
}

// Updates the local copy with what the Maxbox returned, ready for the next outage.
async function cacheEntries(entries) {
  for (const entry of entries) {
    if (!entry || !entry._id) continue;
    try {
      await CalendarEntry.updateOne(
        { _id: entry._id },
        {
          $set: {
            completionStatus: entry.completionStatus,
            progress: entry.progress,
            completionDate: entry.completionDate,
          },
        }
      );
    } catch (error) {
      console.log("Could not cache calendar entry:", error.message);
    }
  }
}

// Gets calendar entries by id, returning { entries, source, degraded }.
async function getEntries(ids = []) {
  if (ids.length === 0) {
    return { entries: [], source: "local", degraded: false };
  }
  // With no Maxbox configured the local collection is the source of truth.
  if (!isRemoteConfigured()) {
    return { entries: await readLocalEntries(ids), source: "local", degraded: false };
  }

  const result = await breaker.run(
    () => fetchRemoteEntries(ids),
    () => readLocalEntries(ids)
  );

  if (result.source === "live") {
    await cacheEntries(result.data);
    return { entries: result.data, source: "live", degraded: false };
  }

  // Serving from cache means the box is unreachable, so flag it as degraded.
  return {
    entries: result.data || [],
    source: "cache",
    degraded: true,
    reason: result.reason,
  };
}

// Sends a progress update to the Maxbox, queueing it if the box is unreachable.
async function pushProgress(entryId, progress) {
  if (!isRemoteConfigured()) {
    return { delivered: true, queued: false, source: "local" };
  }

  const send = async () => {
    const url = `${baseUrl().replace(/\/$/, "")}/api/entries/${entryId}/progress`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MAXBOX_API_KEY
          ? { Authorization: `Bearer ${process.env.MAXBOX_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ progress }),
    });
    if (!response.ok) throw new Error(`Maxbox responded ${response.status}`);
    return response.json();
  };

  const result = await breaker.run(send, null);

  if (result.ok && result.source === "live") {
    return { delivered: true, queued: false, source: "live" };
  }

  pendingWrites.push({ entryId, progress, queuedAt: new Date() });
  await audit.recordRepair({
    action: "calendar.write.queued",
    entityType: "calendar-link",
    entityId: null,
    message: `Maxbox unreachable, queued a progress update for calendar entry ${entryId}`,
  });
  return { delivered: false, queued: true, source: "queue", reason: result.reason };
}

// Retries the queued writes. Safe to call repeatedly, failures go back on the queue.
async function flushQueue() {
  if (pendingWrites.length === 0) {
    return { flushed: 0, remaining: 0 };
  }

  const batch = pendingWrites.splice(0, pendingWrites.length);
  let flushed = 0;

  for (const item of batch) {
    const outcome = await pushProgress(item.entryId, item.progress);
    if (outcome.delivered) {
      flushed += 1;
    }
    // pushProgress puts anything that failed back on the queue.
  }

  return { flushed, remaining: pendingWrites.length };
}

// Current state, shown by the health endpoint and the admin screen.
function status() {
  return {
    configured: isRemoteConfigured(),
    url: isRemoteConfigured() ? baseUrl() : null,
    breaker: breaker.snapshot(),
    queuedWrites: pendingWrites.length,
  };
}

module.exports = {
  getEntries,
  pushProgress,
  flushQueue,
  status,
  breaker,
  pendingWrites,
};
