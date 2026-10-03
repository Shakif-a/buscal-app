const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("net");
const { scanWithEngine } = require("../services/virusEngine");

function startEngine(answer) {
  const seen = { command: "", received: Buffer.alloc(0), sizes: [] };

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let started = false;
    socket.on("error", () => {});

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!started) {
        const end = buffer.indexOf(0);
        if (end === -1) {
          return;
        }
        seen.command = buffer.subarray(0, end).toString();
        buffer = buffer.subarray(end + 1);
        started = true;
      }

      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);

        if (size === 0) {
          const reply = answer(seen.received);
          if (reply === null) {
            return;
          }
          socket.end(reply);
          return;
        }

        if (buffer.length < 4 + size) {
          return;
        }

        seen.sizes.push(size);
        seen.received = Buffer.concat([
          seen.received,
          buffer.subarray(4, 4 + size),
        ]);
        buffer = buffer.subarray(4 + size);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, seen, port: server.address().port });
    });
  });
}

async function withEngine(answer, settings, run) {
  const engine = await startEngine(answer);
  const saved = { ...process.env };

  Object.assign(process.env, {
    CLAMAV_HOST: "127.0.0.1",
    CLAMAV_PORT: String(engine.port),
    CLAMAV_REQUIRED: "false",
    ...settings,
  });

  try {
    return await run(engine);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, saved);
    engine.server.close();
  }
}

test("nothing happens when no engine is configured", async () => {
  const saved = process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_HOST;

  try {
    assert.deepEqual(await scanWithEngine(Buffer.from("hello")), {
      threat: null,
      unavailable: false,
    });
  } finally {
    if (saved !== undefined) {
      process.env.CLAMAV_HOST = saved;
    }
  }
});

test("a clean answer lets the file through and the file arrives intact", async () => {
  const data = Buffer.alloc(300 * 1024, 7);

  await withEngine(() => "stream: OK\0", {}, async (engine) => {
    const result = await scanWithEngine(data);

    assert.deepEqual(result, { threat: null, unavailable: false });
    assert.equal(engine.seen.command, "zINSTREAM");
    assert.ok(engine.seen.received.equals(data));
    assert.ok(engine.seen.sizes.every((size) => size <= 64 * 1024));
  });
});

test("a found answer becomes a threat with the signature name", async () => {
  await withEngine(
    () => "stream: Win.Test.EICAR_HDB-1 FOUND\0",
    {},
    async () => {
      const result = await scanWithEngine(Buffer.from("anything"));

      assert.equal(
        result.threat,
        "the antivirus engine found Win.Test.EICAR_HDB-1",
      );
      assert.equal(result.unavailable, false);
    },
  );
});

test("odd characters in a signature name are removed", async () => {
  await withEngine(
    () => "stream: <b>Bad</b> \u0001 name FOUND\0",
    {},
    async () => {
      const result = await scanWithEngine(Buffer.from("anything"));

      assert.equal(result.threat, "the antivirus engine found bBadbname");
    },
  );
});

test("an empty file and a very large file are both sent correctly", async () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 3, 9);

  await withEngine(() => "stream: OK\0", {}, async (engine) => {
    assert.equal((await scanWithEngine(big)).threat, null);
    assert.equal(engine.seen.received.length, big.length);
  });

  await withEngine(() => "stream: OK\0", {}, async () => {
    assert.equal((await scanWithEngine(Buffer.alloc(0))).threat, null);
  });
});

test("errors, silence and garbage are skipped unless the engine is required", async () => {
  const answers = [
    () => "INSTREAM size limit exceeded. ERROR\0",
    () => "",
    () => "hello there\0",
    () => "stream: OK but not really\0",
  ];

  for (const answer of answers) {
    await withEngine(answer, {}, async () => {
      assert.deepEqual(await scanWithEngine(Buffer.from("x")), {
        threat: null,
        unavailable: false,
      });
    });

    await withEngine(answer, { CLAMAV_REQUIRED: "true" }, async () => {
      assert.deepEqual(await scanWithEngine(Buffer.from("x")), {
        threat: null,
        unavailable: true,
      });
    });
  }
});

test("an engine that never answers times out", async () => {
  await withEngine(
    () => null,
    { CLAMAV_TIMEOUT_MS: "300", CLAMAV_REQUIRED: "true" },
    async () => {
      const started = Date.now();
      const result = await scanWithEngine(Buffer.from("x"));

      assert.equal(result.unavailable, true);
      assert.ok(Date.now() - started < 3000);
    },
  );
});

test("an engine that is not running counts as unavailable", async () => {
  const closed = await startEngine(() => "stream: OK\0");
  const port = closed.port;
  await new Promise((resolve) => closed.server.close(resolve));

  const saved = { ...process.env };
  Object.assign(process.env, {
    CLAMAV_HOST: "127.0.0.1",
    CLAMAV_PORT: String(port),
    CLAMAV_REQUIRED: "true",
  });

  try {
    assert.deepEqual(await scanWithEngine(Buffer.from("x")), {
      threat: null,
      unavailable: true,
    });
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, saved);
  }
});
