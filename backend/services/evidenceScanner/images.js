const { startsWithHex } = require("./fileDetails");

const zipEntrySignature = Buffer.from("504b0304", "hex");

const scriptPattern = /<\?php|<script[\s>/]|<%@\s*page/i;

const maxImageTrailingBytes = 16;

function hasEmbeddedZip(data) {
  let from = 0;

  while (from < data.length) {
    const at = data.indexOf(zipEntrySignature, from);
    if (at === -1 || at + 30 > data.length) {
      return false;
    }

    const version = data.readUInt16LE(at + 4);
    const flags = data.readUInt16LE(at + 6);
    const method = data.readUInt16LE(at + 8);
    if (version <= 63 && flags < 0x1000 && (method === 0 || method === 8)) {
      return true;
    }

    from = at + 1;
  }

  return false;
}

function pngTrailingBytes(data) {
  const last = data.lastIndexOf("IEND", data.length, "latin1");
  return last === -1 ? 0 : Math.max(0, data.length - (last + 8));
}

function scanImage(data, extension) {
  if (scriptPattern.test(data.toString("latin1"))) {
    return "the image has script code hidden inside it";
  }

  if (hasEmbeddedZip(data)) {
    return "the image has an archive hidden inside it";
  }

  if (extension === ".png" && pngTrailingBytes(data) > maxImageTrailingBytes) {
    return "the image has extra data after its end";
  }

  return null;
}

function readJpegSize(data) {
  let at = 2;

  while (at + 9 < data.length) {
    if (data[at] !== 0xff) {
      at++;
      continue;
    }

    const marker = data[at + 1];

    if (marker === 0xff) {
      at++;
    } else if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: data.readUInt16BE(at + 5), width: data.readUInt16BE(at + 7) };
    } else {
      const length = data.readUInt16BE(at + 2);

      if (length < 2) {
        return null;
      }

      at += 2 + length;
    }
  }

  return null;
}

function readImageSize(data) {
  if (data.length >= 24 && startsWithHex(data, "89504e470d0a1a0a")) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }

  if (data.length >= 10 && /^GIF8[79]a/.test(data.toString("latin1", 0, 6))) {
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }

  if (data.length >= 4 && startsWithHex(data, "ffd8ff")) {
    return readJpegSize(data);
  }

  return null;
}

function describeImage(data, extension) {
  const items = [];
  const size = readImageSize(data);

  if (size && size.width > 0 && size.height > 0) {
    items.push("Picture size: " + size.width + " x " + size.height + " pixels");
  }

  const script = data.toString("latin1").match(scriptPattern);
  if (script) {
    items.push('Script code found: "' + script[0].toLowerCase() + '"');
  }

  if (hasEmbeddedZip(data)) {
    items.push("A hidden ZIP archive was found inside the image");
  }

  const extraBytes = pngTrailingBytes(data);
  if (extension === ".png" && extraBytes > maxImageTrailingBytes) {
    items.push(extraBytes + " extra bytes after the end of the image");
  }

  return { kind: "indicators", items };
}

module.exports = { scanImage, describeImage };
