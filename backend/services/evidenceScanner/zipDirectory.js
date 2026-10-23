const zlib = require("zlib");
const { peekBytes } = require("./fileDetails");

const maxZipEntries = 1000;

function findEndOfCentralDirectory(data) {
  const lowest = Math.max(0, data.length - 22 - 65535);

  for (let index = data.length - 22; index >= lowest; index--) {
    if (data.readUInt32LE(index) === 0x06054b50) {
      return index;
    }
  }

  return -1;
}

function readZipDirectory(data) {
  const damaged = "the archive is damaged or cannot be read";
  const end = findEndOfCentralDirectory(data);

  if (end < 0) {
    return { entries: [], problem: damaged };
  }

  const total = data.readUInt16LE(end + 10);
  const directorySize = data.readUInt32LE(end + 12);
  const directoryOffset = data.readUInt32LE(end + 16);

  if (
    total === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    return { entries: [], problem: "ZIP64 archives are not accepted" };
  }

  if (total > maxZipEntries) {
    return { entries: [], problem: "the archive contains too many files" };
  }

  if (directoryOffset + directorySize > end) {
    return { entries: [], problem: damaged };
  }

  const entries = [];
  let offset = directoryOffset;

  for (let index = 0; index < total; index++) {
    if (offset + 46 > end || data.readUInt32LE(offset) !== 0x02014b50) {
      return { entries, problem: damaged };
    }

    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const next = offset + 46 + nameLength + extraLength + commentLength;

    if (next > end) {
      return { entries, problem: damaged };
    }

    entries.push({
      name: data
        .toString("utf8", offset + 46, offset + 46 + nameLength)
        .replace(/[ .]+$/, ""),
      flags: data.readUInt16LE(offset + 8),
      method: data.readUInt16LE(offset + 10),
      compressedSize: data.readUInt32LE(offset + 20),
      uncompressedSize: data.readUInt32LE(offset + 24),
      localOffset: data.readUInt32LE(offset + 42),
    });
    offset = next;
  }

  return { entries, problem: null };
}

function peekEntry(data, localOffset, method, compressedSize) {
  if (
    localOffset + 30 > data.length ||
    data.readUInt32LE(localOffset) !== 0x04034b50
  ) {
    return null;
  }

  const start =
    localOffset +
    30 +
    data.readUInt16LE(localOffset + 26) +
    data.readUInt16LE(localOffset + 28);
  const available = Math.min(compressedSize, peekBytes, data.length - start);

  if (start >= data.length || available <= 0) {
    return null;
  }

  const chunk = data.subarray(start, start + available);

  if (method === 0) {
    return chunk;
  }

  if (method === 8) {
    try {
      return zlib.inflateRawSync(chunk, {
        finishFlush: zlib.constants.Z_SYNC_FLUSH,
      });
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = { readZipDirectory, peekEntry };
