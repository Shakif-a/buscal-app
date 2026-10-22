const net = require("net");

const chunkBytes = 64 * 1024;
const warnEveryMilliseconds = 60 * 1000;
let lastWarning = 0;

function readSettings() {
  const host = (process.env.CLAMAV_HOST || "").trim();

  if (!host) {
    return null;
  }

  return {
    host,
    port: Number(process.env.CLAMAV_PORT) || 3310,
    timeout: Number(process.env.CLAMAV_TIMEOUT_MS) || 15000,
    required: process.env.CLAMAV_REQUIRED === "true",
  };
}

function askEngine(settings, data) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(settings.port, settings.host);
    let reply = "";

    socket.setTimeout(settings.timeout, () => {
      socket.destroy(new Error("the antivirus engine took too long to answer"));
    });
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      reply += chunk.toString("latin1");
    });
    socket.on("close", () => resolve(reply));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");

      for (let offset = 0; offset < data.length; offset += chunkBytes) {
        const part = data.subarray(offset, offset + chunkBytes);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(part.length);
        socket.write(size);
        socket.write(part);
      }

      socket.write(Buffer.alloc(4));
    });
  });
}

function readReply(reply) {
  const text = reply.replace(/\0/g, "").trim();

  if (/^stream:\s*OK$/.test(text)) {
    return { clean: true };
  }

  const found = /^stream:\s*(.+?)\s+FOUND$/.exec(text);
  if (found) {
    const name = found[1].replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 80);
    return { clean: false, signature: name || "an unnamed threat" };
  }

  return null;
}

function warnOnce(message) {
  const now = Date.now();

  if (now - lastWarning > warnEveryMilliseconds) {
    lastWarning = now;
    console.error("Antivirus engine problem: " + message);
  }
}

async function scanWithEngine(data) {
  const settings = readSettings();

  if (!settings) {
    return { threat: null, unavailable: false };
  }

  try {
    const answer = readReply(await askEngine(settings, data));

    if (!answer) {
      throw new Error("the antivirus engine gave an answer that was not understood");
    }

    return {
      threat: answer.clean
        ? null
        : "the antivirus engine found " + answer.signature,
      unavailable: false,
    };
  } catch (error) {
    warnOnce(error.message);
    return { threat: null, unavailable: settings.required };
  }
}

module.exports = { scanWithEngine };
