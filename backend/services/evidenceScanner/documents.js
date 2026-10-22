const { reviewableThreats } = require("./threats");

const oleMacroMarker = Buffer.from("_VBA_PROJECT", "utf16le");

const rtfEmbeddedObject = /\\obj(data|update|autlink|link|emb)(?![a-z])/i;

const csvCommandCell =
  /(^|[\r\n,;\t"])[ ]*[=+\-@][ ]*(cmd|powershell|mshta|rundll32|regsvr32|wscript|cscript|msexcel|dde)\b/i;

const maxPreviewCharacters = 3000;

function scanRtf(data) {
  const found = rtfEmbeddedObject.test(data.toString("latin1"));
  return found ? reviewableThreats.rtfObject : null;
}

function scanCsv(data) {
  const found = csvCommandCell.test(data.toString("utf8"));
  return found ? reviewableThreats.csvFormula : null;
}

function scanOle(data) {
  return data.includes(oleMacroMarker) ? reviewableThreats.macros : null;
}

function describeText(data) {
  const raw = data.subarray(0, maxPreviewCharacters * 4).toString("utf8");
  const text = raw
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g,
      "?",
    )
    .slice(0, maxPreviewCharacters);

  return {
    kind: "text",
    text,
    truncated:
      raw.length > maxPreviewCharacters ||
      data.length > maxPreviewCharacters * 4,
  };
}

function describeOle(data) {
  return {
    kind: "indicators",
    items: data.includes(oleMacroMarker)
      ? ["A macro project (_VBA_PROJECT) was found"]
      : [],
  };
}

function describeRtf(data) {
  const words = data
    .toString("latin1")
    .match(new RegExp(rtfEmbeddedObject, "gi"));
  const found = new Set((words || []).map((word) => word.toLowerCase()));

  return {
    kind: "indicators",
    items: [...found].map((word) => "Embedded object control word: " + word),
  };
}

module.exports = {
  scanRtf,
  scanCsv,
  scanOle,
  describeText,
  describeOle,
  describeRtf,
};
