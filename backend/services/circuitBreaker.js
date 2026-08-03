// Stops the app hanging on a service that is not responding.
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
    // Counters shown by the health endpoint.
    this.stats = { calls: 0, failures: 0, rejections: 0, fallbacks: 0 };
  }
  // Wraps a promise so a hung request cannot wait forever.
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

  // True once the cool-off has passed and one test request can go through.
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

  // Runs the operation, falling back to cached data instead of throwing when it fails.
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

  // Current state, reported by the health endpoint.
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

  // Clears the breaker, used by tests and the admin retry button.
  reset() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.openedAt = null;
    this.lastError = null;
  }
}

module.exports = { CircuitBreaker, STATES };
