const { CircuitBreaker } = require("./circuitBreaker");
const CalendarEntry = require("../models/calendarEntryModel");
const audit = require("./okrAuditService");

// ---------------------------------------------------------------------------
// Maxbox calendar client.
//
// Micromax's calendar runs on a box in the customer's office. This module is
// the only place that talks to it, so if the contract changes we edit one file.
//
// Two things make it safe to depend on:
//
//   1. Every call goes through a circuit breaker. When the box stops answering
//      we stop hammering it and serve the last known state from MongoDB
//      instead. The response says whether the data is live or cached so the UI
//      can label it honestly rather than quietly showing stale numbers.
//
//   2. Writes that fail are queued rather than lost. When the box comes back,
//      flushQueue drains them in order. Progress a user recorded during an
//      outage still lands.
//
// When MAXBOX_CALENDAR_URL is not set we read the local CalendarEntry
// collection directly, which is how development and the test suite run.
// ---------------------------------------------------------------------------

const breaker = new CircuitBreaker({
  name: "maxbox-calendar",
  failureThreshold: Number(process.env.MAXBOX_FAILURE_THRESHOLD || 3),
  cooldownMs: Number(process.env.MAXBOX_COOLDOWN_MS || 30000),
  timeoutMs: Number(process.env.MAXBOX_TIMEOUT_MS || 5000),
});

// Writes waiting for the Maxbox to come back. In memory on purpose: a single
// appliance, and anything critical is already in MongoDB. If Micromax later
// wants these to survive a restart, promote this array to a collection.
const pendingWrites = [];

function baseUrl() {
  return process.env.MAXBOX_CALENDAR_URL || "";
}

function isRemoteConfigured() {
  return baseUrl().length > 0;
}

// ---- Reads ----------------------------------------------------------------

// Fetch entries from the Maxbox. Only called when a remote URL is configured.
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

// The fallback: whatever we last stored locally.
async function readLocalEntries(ids) {
  return CalendarEntry.find({ _id: { $in: ids } });
}

// Keep the local copy in step with what the Maxbox just told us, so the next
// outage has fresh data to fall back on.
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

// Get calendar entries by id. Always returns something usable.
// Shape: { entries, source: "live" | "cache" | "local", degraded: boolean }
async function getEntries(ids = []) {
  if (ids.length === 0) {
    return { entries: [], source: "local", degraded: false };
  }

  // No Maxbox configured: the local collection is the source of truth.
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

  // Serving from cache means the box is unreachable. Say so.
  return {
    entries: result.data || [],
    source: "cache",
    degraded: true,
    reason: result.reason,
  };
}

// ---- Writes ---------------------------------------------------------------

// Push a progress update back to the Maxbox. If it cannot be delivered the
// update is queued and the caller is told it is pending rather than failed.
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

// Drain the queue. Safe to call repeatedly; anything that fails goes back on.
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
    // pushProgress re-queues anything that failed, so nothing is dropped.
  }

  return { flushed, remaining: pendingWrites.length };
}

// What the health endpoint and the admin screen show.
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
