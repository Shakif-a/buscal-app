// ---------------------------------------------------------------------------
// Circuit breaker.
//
// The Maxbox sits on a customer's premises. It gets rebooted, unplugged, and
// put behind flaky office wifi. Without protection, every OKR page load would
// sit waiting on a box that is not answering, and one dead appliance would take
// the whole dashboard down with it.
//
// The breaker watches failures. After enough of them it opens, and further
// calls fail instantly instead of hanging, which is what lets the caller fall
// back to cached data quickly. After a cool-off it lets a single request
// through to test the water. If that works the breaker closes and normal
// service resumes.
//
// Written by hand rather than pulled from npm: this ships on customer hardware,
// so every dependency is one more thing to patch, and the logic is forty lines.
// ---------------------------------------------------------------------------

const STATES = {
  CLOSED: "closed", // healthy, calls go through
  OPEN: "open", // failing, calls are rejected immediately
  HALF_OPEN: "half-open", // testing whether it recovered
};

class CircuitBreaker {
  constructor({
    name = "service",
    failureThreshold = 3, // consecutive failures before we give up
    cooldownMs = 30000, // how long to stay open before testing again
    timeoutMs = 5000, // a call slower than this counts as a failure
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.timeoutMs = timeoutMs;

    this.state = STATES.CLOSED;
    this.failures = 0;
    this.openedAt = null;
    this.lastError = null;
    // Counters, purely so the health endpoint can show what has been happening.
    this.stats = { calls: 0, failures: 0, rejections: 0, fallbacks: 0 };
  }

  // Wrap a promise so a hung request cannot wait forever.
  withTimeout(promise) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${this.name} timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  // Has the cool-off passed, so we can try one probe request?
  readyToRetry() {
    return this.openedAt !== null && Date.now() - this.openedAt >= this.cooldownMs;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = STATES.CLOSED;
    this.openedAt = null;
    this.lastError = null;
  }

  recordFailure(error) {
    this.failures += 1;
    this.stats.failures += 1;
    this.lastError = error.message;
    if (this.failures >= this.failureThreshold) {
      this.state = STATES.OPEN;
      this.openedAt = Date.now();
      console.log(`Circuit breaker for ${this.name} opened after ${this.failures} failures`);
    }
  }

  // Run the operation through the breaker. If it cannot run, or it fails, and a
  // fallback was supplied, the fallback result is returned instead of throwing.
  // The caller gets told which path was taken so it can label stale data.
  async run(operation, fallback = null) {
    this.stats.calls += 1;

    if (this.state === STATES.OPEN) {
      if (this.readyToRetry()) {
        this.state = STATES.HALF_OPEN;
      } else {
        this.stats.rejections += 1;
        return this.useFallback(fallback, `${this.name} is unavailable`);
      }
    }

    try {
      const result = await this.withTimeout(operation());
      this.recordSuccess();
      return { ok: true, source: "live", data: result };
    } catch (error) {
      this.recordFailure(error);
      return this.useFallback(fallback, error.message);
    }
  }

  async useFallback(fallback, reason) {
    if (typeof fallback !== "function") {
      return { ok: false, source: "none", data: null, reason };
    }
    this.stats.fallbacks += 1;
    const data = await fallback();
    return { ok: true, source: "cache", data, reason };
  }

  // What the health endpoint reports.
  snapshot() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
      lastError: this.lastError,
      stats: { ...this.stats },
    };
  }

  // Used by tests and by an admin "try again now" button.
  reset() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.openedAt = null;
    this.lastError = null;
  }
}

module.exports = { CircuitBreaker, STATES };
