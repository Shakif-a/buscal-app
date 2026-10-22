const { eicar, startsLikeProgram } = require("./signatures");
const { reviewableThreats, canBeApproved } = require("./threats");
const { openDocumentExtensions } = require("./extensions");
const { cleanLabel } = require("./fileDetails");
const { readZipDirectory, peekEntry } = require("./zipDirectory");

const maxUnpackedBytes = 100 * 1024 * 1024;

const maxCompressionRatio = 500;

const ratioCheckMinimumBytes = 1024 * 1024;

const maxListedEntries = 100;

const dangerousEntryName =
  /\.(exe|dll|sys|ocx|scr|com|bat|cmd|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|msi|msp|lnk|pif|reg|sh|cpl|msc|apk|iso|vhd|jar|docm|xlsm|pptm|dotm|xltm|potm|ppam|xlam)$/i;

const nestedArchiveName = /\.(zip|7z|rar|gz|tgz|tar|bz2|xz|cab)$/i;

function unsafeEntryName(name) {
  const clean = name.replace(/\\/g, "/");
  return (
    clean.startsWith("/") ||
    /^[a-zA-Z]:/.test(clean) ||
    clean.split("/").includes("..")
  );
}

function entryThreat(data, entry, extension, checkedOffsets = new Set()) {
  const { name } = entry;

  if (
    entry.uncompressedSize > ratioCheckMinimumBytes &&
    entry.uncompressedSize > entry.compressedSize * maxCompressionRatio
  ) {
    return "the archive looks like a zip bomb";
  }

  if (unsafeEntryName(name)) {
    return "the archive contains a file with an unsafe path";
  }

  if (dangerousEntryName.test(name)) {
    return reviewableThreats.archiveProgram;
  }

  if (nestedArchiveName.test(name)) {
    return reviewableThreats.nestedArchive;
  }

  if (/(^|\/)vbaProject\.bin$/i.test(name.replace(/\\/g, "/"))) {
    return reviewableThreats.macros;
  }

  if (
    openDocumentExtensions.includes(extension) &&
    /^(Scripts|Basic)\//i.test(name)
  ) {
    return reviewableThreats.macros;
  }

  const alreadyChecked = checkedOffsets.has(entry.localOffset);
  checkedOffsets.add(entry.localOffset);

  const head =
    entry.flags & 1 || alreadyChecked
      ? null
      : peekEntry(data, entry.localOffset, entry.method, entry.compressedSize);
  if (head) {
    if (head.includes(eicar)) {
      return "it contains a known virus test signature";
    }

    if (startsLikeProgram(head)) {
      return "the archive contains a hidden program";
    }
  }

  return null;
}

function scanZip(data, extension) {
  const directory = readZipDirectory(data);
  const checkedOffsets = new Set();
  let declaredTotal = 0;
  let reviewable = null;

  for (const entry of directory.entries) {
    if (
      entry.compressedSize === 0xffffffff ||
      entry.uncompressedSize === 0xffffffff
    ) {
      return "ZIP64 archives are not accepted";
    }

    declaredTotal += entry.uncompressedSize;
    if (declaredTotal > maxUnpackedBytes) {
      return "the archive would unpack to an unsafe amount of data";
    }

    const threat =
      entryThreat(data, entry, extension, checkedOffsets) ||
      (entry.flags & 1 ? reviewableThreats.encryptedEntry : null);

    if (threat && !canBeApproved(threat)) {
      return threat;
    }

    reviewable = reviewable || threat;
  }

  return directory.problem || reviewable;
}

function describeArchive(data, extension) {
  const directory = readZipDirectory(data);
  const entries = directory.entries.slice(0, maxListedEntries).map((entry) => {
    const reason = entryThreat(data, entry, extension);
    return {
      name: cleanLabel(entry.name),
      size: entry.uncompressedSize,
      flagged: Boolean(reason) || Boolean(entry.flags & 1),
      reason: reason || (entry.flags & 1 ? "encrypted file" : ""),
    };
  });

  return {
    kind: "archive",
    total: directory.entries.length,
    truncated: directory.entries.length > maxListedEntries,
    problem: directory.problem || "",
    entries,
  };
}

module.exports = { scanZip, describeArchive };
