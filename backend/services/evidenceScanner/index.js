const crypto = require("crypto");
const { eicar, dosStub } = require("./signatures");
const { canBeApproved, adviceFor } = require("./threats");
const {
  zipExtensions,
  imageExtensions,
  oleExtensions,
  textExtensions,
} = require("./extensions");
const { scanZip, describeArchive } = require("./zip");
const { scanPdf, describePdf } = require("./pdf");
const { scanImage, describeImage } = require("./images");
const {
  scanRtf,
  scanCsv,
  scanOle,
  describeText,
  describeOle,
  describeRtf,
} = require("./documents");
const { hexHeadBytes, sniffType, hexDump } = require("./fileDetails");

function findThreat(extension, data) {
  if (data.includes(eicar)) {
    return "it contains a known virus test signature";
  }

  if (data.includes(dosStub)) {
    return "it contains an embedded Windows program";
  }

  if (extension === ".pdf") {
    return scanPdf(data);
  }

  if (extension === ".rtf") {
    return scanRtf(data);
  }

  if (extension === ".csv") {
    return scanCsv(data);
  }

  if (oleExtensions.includes(extension)) {
    return scanOle(data);
  }

  if (zipExtensions.includes(extension)) {
    return scanZip(data, extension);
  }

  if (imageExtensions.includes(extension)) {
    return scanImage(data, extension);
  }

  return null;
}

function buildPreview(extension, data) {
  if (zipExtensions.includes(extension)) {
    return describeArchive(data, extension);
  }

  if (textExtensions.includes(extension)) {
    return describeText(data);
  }

  if (extension === ".pdf") {
    return describePdf(data);
  }

  if (oleExtensions.includes(extension)) {
    return describeOle(data);
  }

  if (extension === ".rtf") {
    return describeRtf(data);
  }

  if (imageExtensions.includes(extension)) {
    return describeImage(data, extension);
  }

  return { kind: "none" };
}

function inspectFile(extension, data) {
  return {
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
    detectedType: sniffType(data),
    hexHead: hexDump(data.subarray(0, hexHeadBytes)),
    preview: buildPreview(extension, data),
  };
}

module.exports = { findThreat, inspectFile, canBeApproved, adviceFor };
