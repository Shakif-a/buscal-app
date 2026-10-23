const zlib = require("zlib");
const { cleanLabel } = require("./fileDetails");
const { reviewableThreats } = require("./threats");

const maxObjectStreamBytes = 4 * 1024 * 1024;

const maxObjectStreamTotal = 8 * 1024 * 1024;

const maxContextCharacters = 140;

const pdfKeywords = ["JavaScript", "Launch", "EmbeddedFile", "RichMedia"];

const pdfActiveContent =
  /\/(JavaScript|Launch|EmbeddedFile|RichMedia)(?![A-Za-z0-9])/;

function decodePdfNames(text) {
  return text.replace(/#([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function readPdfObjectStreams(data) {
  const parts = [];
  let from = 0;
  let budget = maxObjectStreamTotal;

  while (budget > 0) {
    const marker = data.indexOf("/ObjStm", from, "latin1");
    if (marker === -1) {
      break;
    }
    from = marker + 7;

    const begin = data.indexOf("stream", from, "latin1");
    if (begin === -1) {
      break;
    }

    let bodyStart = begin + 6;
    if (data[bodyStart] === 0x0d) {
      bodyStart++;
    }
    if (data[bodyStart] === 0x0a) {
      bodyStart++;
    }

    const bodyEnd = data.indexOf("endstream", bodyStart, "latin1");
    if (bodyEnd === -1) {
      break;
    }

    try {
      const inflated = zlib.inflateSync(data.subarray(bodyStart, bodyEnd), {
        maxOutputLength: maxObjectStreamBytes,
        finishFlush: zlib.constants.Z_SYNC_FLUSH,
      });
      parts.push(inflated.toString("latin1"));
      budget -= inflated.length;
    } catch {
      budget -= maxObjectStreamBytes / 8;
    }
  }

  return parts.join("\n");
}

function readHiddenPdfText(data) {
  if (!data.includes("/ObjStm", 0, "latin1")) {
    return "";
  }

  return decodePdfNames(readPdfObjectStreams(data));
}

function scanPdf(data) {
  const visible = decodePdfNames(data.toString("latin1"));
  const found =
    pdfActiveContent.test(visible) ||
    pdfActiveContent.test(readHiddenPdfText(data));

  return found ? reviewableThreats.pdfActive : null;
}

function countMatches(text, pattern) {
  const found = text.match(pattern);
  return found ? found.length : 0;
}

function contextAround(text, keyword) {
  const at = text.search(new RegExp("/" + keyword + "(?![A-Za-z0-9])"));

  if (at === -1) {
    return "";
  }

  return cleanLabel(
    text.slice(at, at + maxContextCharacters).replace(/\s+/g, " "),
    maxContextCharacters,
  );
}

function describePdf(data) {
  const visible = decodePdfNames(data.toString("latin1"));
  const hidden = readHiddenPdfText(data);
  const items = [];

  for (const keyword of pdfKeywords) {
    const pattern = new RegExp("/" + keyword + "(?![A-Za-z0-9])", "g");
    const inPlain = countMatches(visible, pattern);
    const inCompressed = countMatches(hidden, pattern);

    if (inPlain + inCompressed > 0) {
      const sample =
        contextAround(visible, keyword) || contextAround(hidden, keyword);

      items.push(
        "/" +
          keyword +
          " found " +
          (inPlain + inCompressed) +
          (inPlain + inCompressed === 1 ? " time" : " times") +
          (inCompressed > 0
            ? " (" + inCompressed + " hidden inside compressed data)"
            : "") +
          '. The first one reads: "' +
          sample +
          '"',
      );
    }
  }

  return { kind: "indicators", items };
}

module.exports = { scanPdf, describePdf };
