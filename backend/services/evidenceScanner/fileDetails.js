const { startsWithShebang, startsLikeProgram } = require("./signatures");

const hexHeadBytes = 256;

const peekBytes = 512;

function cleanLabel(value, limit = 200) {
  return String(value)
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g,
      "?",
    )
    .slice(0, limit);
}

function startsWithHex(data, hex) {
  return data.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
}

const knownTypes = [
  ["255044462d", "PDF document"],
  ["89504e470d0a1a0a", "PNG image"],
  ["ffd8ff", "JPEG image"],
  ["474946383761", "GIF image"],
  ["474946383961", "GIF image"],
  ["d0cf11e0a1b11ae1", "Older Microsoft Office file"],
  ["504b0304", "ZIP archive or modern Office file"],
  ["504b0506", "ZIP archive or modern Office file"],
  ["504b0708", "ZIP archive or modern Office file"],
  ["7b5c727466", "RTF document"],
];

function sniffType(data) {
  const head = data.subarray(0, peekBytes);

  if (startsWithHex(head, "7f454c46")) {
    return "Linux program";
  }

  if (startsWithHex(head, "4d5a") && startsLikeProgram(head)) {
    return "Windows program";
  }

  if (startsWithShebang(head)) {
    return "Script";
  }

  if (startsLikeProgram(head)) {
    return "Program or Java class";
  }

  const known = knownTypes.find(([signature]) => startsWithHex(head, signature));
  if (known) {
    return known[1];
  }

  const isWebp =
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP";
  if (isWebp) {
    return "WebP image";
  }

  return head.includes(0) ? "Unknown binary data" : "Plain text";
}

function hexDump(data) {
  const lines = [];

  for (let offset = 0; offset < data.length; offset += 16) {
    const row = data.subarray(offset, offset + 16);
    const hex = Array.from(row, (byte) => byte.toString(16).padStart(2, "0"));
    const left = hex.slice(0, 8).join(" ");
    const right = hex.slice(8).join(" ");
    const ascii = Array.from(row, (byte) =>
      byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".",
    ).join("");

    lines.push(
      offset.toString(16).padStart(8, "0") +
        "  " +
        left.padEnd(23, " ") +
        "  " +
        right.padEnd(23, " ") +
        "  |" +
        ascii +
        "|",
    );
  }

  return lines.join("\n");
}

module.exports = {
  hexHeadBytes,
  peekBytes,
  cleanLabel,
  sniffType,
  hexDump,
  startsWithHex,
};
