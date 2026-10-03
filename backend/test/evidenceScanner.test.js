const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("zlib");
const {
  findThreat,
  inspectFile,
  canBeApproved,
  adviceFor,
} = require("../services/evidenceScanner");

const eicarText = [
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
  "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
  "$H+H*",
].join("");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content || "");
    const stored = entry.deflate ? zlib.deflateRawSync(content) : content;
    const method = entry.deflate ? 8 : 0;
    const flags = entry.flags || 0;
    const declared =
      entry.declaredSize === undefined ? content.length : entry.declaredSize;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(declared, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, stored);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(content), 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(declared, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);

    offset += 30 + name.length + stored.length;
  }

  const directoryBuffer = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, directoryBuffer, end]);
}

function windowsProgram() {
  const program = Buffer.alloc(256);
  program.write("MZ", 0);
  program.writeUInt32LE(0x80, 0x3c);
  program.writeUInt32LE(0x4550, 0x80);
  return program;
}

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const pngEnd = Buffer.from("0000000049454e44ae426082", "hex");

function cleanPng(extra = Buffer.alloc(0)) {
  return Buffer.concat([
    pngSignature,
    Buffer.from("0000000d49484452", "hex"),
    Buffer.alloc(17, 1),
    pngEnd,
    extra,
  ]);
}

function noise(size) {
  const data = Buffer.alloc(size);
  let state = 12345;
  for (let index = 0; index < size; index++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    data[index] = (state >>> 16) & 0xff;
  }
  return data;
}

test("ordinary files of every checked type pass", () => {
  assert.equal(
    findThreat(
      ".pdf",
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj"),
    ),
    null,
  );
  assert.equal(findThreat(".png", cleanPng()), null);
  assert.equal(
    findThreat(".csv", Buffer.from("name,change\nsales,-5\ncost,+3\n")),
    null,
  );
  assert.equal(findThreat(".txt", Buffer.from("plain notes")), null);
  assert.equal(findThreat(".rtf", Buffer.from("{\\rtf1 Plain text}")), null);
  assert.equal(
    findThreat(
      ".docx",
      makeZip([
        { name: "[Content_Types].xml", content: "<Types/>" },
        { name: "word/document.xml", content: "<w:document/>", deflate: true },
      ]),
    ),
    null,
  );
  assert.equal(
    findThreat(
      ".xlsx",
      makeZip([
        { name: "xl/workbook.xml", content: "<workbook/>", deflate: true },
        { name: "xl/worksheets/sheet1.xml", content: "<sheet/>" },
      ]),
    ),
    null,
  );
  assert.equal(findThreat(".zip", makeZip([])), null);
  assert.equal(
    findThreat(
      ".zip",
      makeZip([{ name: "reports/q1.txt", content: "numbers", deflate: true }]),
    ),
    null,
  );
});

test("large random files do not cause false alarms", () => {
  const body = noise(5 * 1024 * 1024 - 64);
  assert.equal(findThreat(".pdf", Buffer.concat([Buffer.from("%PDF-1.7\n"), body])), null);
  assert.equal(findThreat(".png", Buffer.concat([pngSignature, body, pngEnd])), null);
  assert.equal(findThreat(".jpg", Buffer.concat([Buffer.from("ffd8ff", "hex"), body])), null);
  assert.equal(findThreat(".doc", Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), body])), null);
});

test("the standard virus test string is caught in plain files and inside archives", () => {
  assert.match(findThreat(".txt", Buffer.from(eicarText)), /virus test/);
  assert.match(
    findThreat(".pdf", Buffer.from("%PDF-1.4\n" + eicarText)),
    /virus test/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip([{ name: "notes.txt", content: eicarText, deflate: true }]),
    ),
    /virus test/,
  );
});

test("PDF scripts, launch actions and embedded files are blocked, including hidden ones", () => {
  assert.match(
    findThreat(
      ".pdf",
      Buffer.from("%PDF-1.4\n<< /S /JavaScript /JS (app.alert(1)) >>"),
    ),
    /PDF/,
  );
  assert.match(
    findThreat(".pdf", Buffer.from("%PDF-1.4\n<< /S /J#61vaScript /JS (x) >>")),
    /PDF/,
  );
  assert.match(
    findThreat(".pdf", Buffer.from("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>")),
    /PDF/,
  );
  assert.match(
    findThreat(".pdf", Buffer.from("%PDF-1.4\n<< /Type /EmbeddedFile >>")),
    /PDF/,
  );

  const hidden = zlib.deflateSync(
    Buffer.from("6 0 << /S /JavaScript /JS (app.alert(1)) >>"),
  );
  const objectStream = Buffer.concat([
    Buffer.from(
      "%PDF-1.5\n5 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode >>\nstream\n",
    ),
    hidden,
    Buffer.from("\nendstream\nendobj\n"),
  ]);
  assert.match(findThreat(".pdf", objectStream), /PDF/);

  const cleanObjectStream = Buffer.concat([
    Buffer.from(
      "%PDF-1.5\n5 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode >>\nstream\n",
    ),
    zlib.deflateSync(Buffer.from("6 0 << /Type /Page >>")),
    Buffer.from("\nendstream\nendobj\n"),
  ]);
  assert.equal(findThreat(".pdf", cleanObjectStream), null);
});

test("macros are blocked in modern and legacy Office files and OpenDocument files", () => {
  assert.match(
    findThreat(
      ".docx",
      makeZip([
        { name: "word/document.xml", content: "<w/>" },
        { name: "word/vbaProject.bin", content: "macro" },
      ]),
    ),
    /macros/,
  );
  assert.match(
    findThreat(
      ".odt",
      makeZip([
        { name: "content.xml", content: "<c/>" },
        { name: "Basic/Standard/Module1.xml", content: "<m/>" },
      ]),
    ),
    /macros/,
  );
  for (const extension of [".doc", ".xls", ".ppt"]) {
    const legacy = Buffer.concat([
      Buffer.from("d0cf11e0a1b11ae1", "hex"),
      Buffer.alloc(64),
      Buffer.from("_VBA_PROJECT", "utf16le"),
    ]);
    assert.match(findThreat(extension, legacy), /macros/);
    assert.equal(
      findThreat(
        extension,
        Buffer.concat([
          Buffer.from("d0cf11e0a1b11ae1", "hex"),
          Buffer.alloc(64),
        ]),
      ),
      null,
    );
  }
});

test("archives with programs, unsafe paths, encryption, nesting or bombs are blocked", () => {
  assert.match(
    findThreat(".zip", makeZip([{ name: "invoice.exe", content: "x" }])),
    /program, script or macro/,
  );
  assert.match(
    findThreat(".zip", makeZip([{ name: "invoice.pdf.exe ", content: "x" }])),
    /program, script or macro/,
  );
  assert.match(
    findThreat(".zip", makeZip([{ name: "../../escape.txt", content: "x" }])),
    /unsafe path/,
  );
  assert.match(
    findThreat(".zip", makeZip([{ name: "C:/escape.txt", content: "x" }])),
    /unsafe path/,
  );
  assert.match(
    findThreat(".zip", makeZip([{ name: "locked.txt", content: "x", flags: 1 }])),
    /encrypted/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip([{ name: "inner.zip", content: makeZip([]) }]),
    ),
    /another archive/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip([
        {
          name: "huge.txt",
          content: "a",
          declaredSize: 50 * 1024 * 1024,
        },
      ]),
    ),
    /zip bomb/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip([
        { name: "a.txt", content: "a", declaredSize: 60 * 1024 * 1024 },
        { name: "b.txt", content: "b", declaredSize: 60 * 1024 * 1024 },
      ]),
    ),
    /unsafe amount|zip bomb/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip(
        Array.from({ length: 1001 }, (_, index) => ({
          name: "f" + index + ".txt",
          content: "x",
        })),
      ),
    ),
    /too many files/,
  );
});

test("programs renamed inside an archive are found by their contents", () => {
  const program = windowsProgram();
  assert.match(
    findThreat(".zip", makeZip([{ name: "photo.txt", content: program }])),
    /hidden program/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip([{ name: "photo.txt", content: program, deflate: true }]),
    ),
    /hidden program/,
  );
  assert.match(
    findThreat(
      ".docx",
      makeZip([{ name: "word/media/image1.png", content: "#!/bin/sh\nrm -rf /" }]),
    ),
    /hidden program/,
  );
  assert.match(
    findThreat(
      ".zip",
      makeZip([{ name: "tool", content: "\x7fELF" + "\0".repeat(60) }]),
    ),
    /hidden program/,
  );
});

test("a damaged archive is rejected", () => {
  assert.match(
    findThreat(".zip", Buffer.concat([Buffer.from("504b0304", "hex"), Buffer.alloc(100)])),
    /damaged/,
  );
  assert.match(
    findThreat(".docx", makeZip([{ name: "a.xml", content: "x" }]).subarray(0, 40)),
    /damaged/,
  );
});

test("an embedded Windows program is found in any file type", () => {
  const program = windowsProgram();
  const stub = Buffer.from("This program cannot be run in DOS mode");
  assert.match(
    findThreat(".pdf", Buffer.concat([Buffer.from("%PDF-1.4\n"), stub])),
    /Windows program/,
  );
  assert.match(
    findThreat(".png", Buffer.concat([cleanPng(), program, stub])),
    /Windows program/,
  );
});

test("images with hidden scripts, archives or trailing data are blocked", () => {
  assert.match(
    findThreat(".png", cleanPng(Buffer.from("<?php system($_GET['c']); ?>"))),
    /script code/,
  );
  assert.match(
    findThreat(
      ".jpg",
      Buffer.concat([Buffer.from("ffd8ff", "hex"), Buffer.from("<script>alert(1)</script>")]),
    ),
    /script code/,
  );
  assert.match(
    findThreat(".png", cleanPng(makeZip([{ name: "a.txt", content: "x" }]))),
    /archive hidden/,
  );
  assert.match(
    findThreat(".png", cleanPng(Buffer.alloc(500, 7))),
    /extra data/,
  );
  assert.equal(findThreat(".png", cleanPng(Buffer.alloc(8))), null);
});

test("RTF objects and spreadsheet command formulas are blocked", () => {
  assert.match(
    findThreat(".rtf", Buffer.from("{\\rtf1{\\object\\objemb{\\*\\objdata 0105}}}")),
    /embedded object/,
  );
  assert.match(
    findThreat(".csv", Buffer.from("name,total\nx,=cmd|' /C calc'!A0\n")),
    /command formula/,
  );
  assert.match(
    findThreat(".csv", Buffer.from("=powershell -enc AAAA\n")),
    /command formula/,
  );
  assert.equal(
    findThreat(".csv", Buffer.from("item,note\nA,=SUM(1,2)\nB,-3\n")),
    null,
  );
});

test("inspection reports the fingerprint, the real type and the first bytes", () => {
  const program = windowsProgram();
  const report = inspectFile(".pdf", program);
  assert.equal(
    report.sha256,
    require("crypto").createHash("sha256").update(program).digest("hex"),
  );
  assert.equal(report.detectedType, "Windows program");
  assert.equal(report.hexHead.split("\n").length, 16);
  assert.match(report.hexHead.split("\n")[0], /^00000000 {2}4d 5a 00 00/);
  assert.match(report.hexHead.split("\n")[0], /\|MZ\.+\|$/);

  const types = {
    "%PDF-1.4": "PDF document",
    "plain notes": "Plain text",
    "{\\rtf1 hi}": "RTF document",
  };
  for (const [content, label] of Object.entries(types)) {
    assert.equal(inspectFile(".txt", Buffer.from(content)).detectedType, label);
  }
  assert.equal(inspectFile(".png", cleanPng()).detectedType, "PNG image");
  assert.equal(
    inspectFile(".zip", makeZip([{ name: "a.txt", content: "x" }])).detectedType,
    "ZIP archive or modern Office file",
  );
  assert.equal(
    inspectFile(".bin", Buffer.from("#!/bin/sh\nrm -rf /")).detectedType,
    "Script",
  );
  assert.equal(
    inspectFile(".bin", Buffer.concat([Buffer.from([1, 0, 2, 0]), Buffer.alloc(8)])).detectedType,
    "Unknown binary data",
  );
});

test("inspection previews text safely and strips hidden control characters", () => {
  const hostile = "line one\u202etxt.exe\u0000\u001b[31mred\nline two";
  const preview = inspectFile(".csv", Buffer.from(hostile)).preview;
  assert.equal(preview.kind, "text");
  assert.equal(preview.text.includes("\u202e"), false);
  assert.equal(preview.text.includes("\u0000"), false);
  assert.equal(preview.text.includes("\u001b"), false);
  assert.match(preview.text, /line one\?txt\.exe\?\?\[31mred\nline two/);
  assert.equal(preview.truncated, false);

  const long = inspectFile(".txt", Buffer.from("a".repeat(10000))).preview;
  assert.equal(long.text.length, 3000);
  assert.equal(long.truncated, true);
});

test("inspection lists archive contents, flags the risky entries and cleans their names", () => {
  const zip = makeZip([
    { name: "docs/readme.txt", content: "hello" },
    { name: "setup.exe", content: "x" },
    { name: "report\u202efdp.exe", content: "x" },
    { name: "photo.txt", content: windowsProgram() },
  ]);
  const preview = inspectFile(".zip", zip).preview;
  assert.equal(preview.kind, "archive");
  assert.equal(preview.total, 4);
  assert.equal(preview.entries[0].flagged, false);
  assert.equal(preview.entries[1].flagged, true);
  assert.match(preview.entries[1].reason, /program, script or macro/);
  assert.equal(preview.entries[2].name.includes("\u202e"), false);
  assert.equal(preview.entries[2].flagged, true);
  assert.equal(preview.entries[3].flagged, true);
  assert.match(preview.entries[3].reason, /hidden program/);

  const many = inspectFile(
    ".zip",
    makeZip(Array.from({ length: 150 }, (_, index) => ({ name: "f" + index + ".txt", content: "x" }))),
  ).preview;
  assert.equal(many.entries.length, 100);
  assert.equal(many.total, 150);
  assert.equal(many.truncated, true);

  const broken = inspectFile(".docx", Buffer.concat([Buffer.from("504b0304", "hex"), Buffer.alloc(40)])).preview;
  assert.match(broken.problem, /damaged/);
});

test("inspection describes PDF, macro, RTF and image indicators", () => {
  const plain = inspectFile(
    ".pdf",
    Buffer.from("%PDF-1.4\n<< /S /JavaScript >> << /S /JavaScript >> /Launch"),
  ).preview;
  assert.equal(plain.kind, "indicators");
  assert.match(plain.items.join("|"), /\/JavaScript found 2 times/);
  assert.match(plain.items.join("|"), /\/Launch found 1 time\b/);

  const hidden = Buffer.concat([
    Buffer.from("%PDF-1.5\n5 0 obj\n<< /Type /ObjStm /Filter /FlateDecode >>\nstream\n"),
    zlib.deflateSync(Buffer.from("6 0 << /S /JavaScript >>")),
    Buffer.from("\nendstream\n"),
  ]);
  assert.match(inspectFile(".pdf", hidden).preview.items.join("|"), /hidden inside compressed data/);

  assert.match(
    inspectFile(
      ".doc",
      Buffer.concat([Buffer.from("d0cf11e0a1b11ae1", "hex"), Buffer.from("_VBA_PROJECT", "utf16le")]),
    ).preview.items[0],
    /macro project/,
  );
  assert.deepEqual(
    inspectFile(".doc", Buffer.from("d0cf11e0a1b11ae1", "hex")).preview.items,
    [],
  );
  assert.match(
    inspectFile(".rtf", Buffer.from("{\\rtf1{\\object\\objemb{\\*\\objdata 01}}}")).preview.items.join("|"),
    /\\objemb/,
  );
  assert.match(
    inspectFile(".png", cleanPng(Buffer.from("<?php echo 1; ?>"))).preview.items.join("|"),
    /Script code found/,
  );
  assert.deepEqual(inspectFile(".bin", Buffer.from("abc")).preview, { kind: "none" });
});

test("only findings a person can judge are approvable", () => {
  for (const reason of [
    "the archive contains a program, script or macro file",
    "the archive contains another archive",
    "the archive contains an encrypted file which cannot be checked",
    "the document contains macros",
    "the PDF contains scripts, launch actions or embedded files",
    "the RTF document contains an embedded object",
    "the spreadsheet contains a command formula",
  ]) {
    assert.equal(canBeApproved(reason), true, reason);
  }

  for (const reason of [
    "it contains a known virus test signature",
    "it contains an embedded Windows program",
    "the archive contains a hidden program",
    "the archive contains a file with an unsafe path",
    "the archive looks like a zip bomb",
    "the archive would unpack to an unsafe amount of data",
    "the archive is damaged or cannot be read",
    "ZIP64 archives are not accepted",
    "the archive contains too many files",
    "the image has script code hidden inside it",
    "the image has an archive hidden inside it",
    "the image has extra data after its end",
    "",
    null,
    undefined,
  ]) {
    assert.equal(canBeApproved(reason), false, String(reason));
  }
});

test("an archive is approvable only when every finding inside it is approvable", () => {
  const program = windowsProgram();

  assert.equal(
    canBeApproved(
      findThreat(
        ".zip",
        makeZip([
          { name: "setup.exe", content: "x" },
          { name: "run.bat", content: "x" },
          { name: "locked.txt", content: "x", flags: 1 },
        ]),
      ),
    ),
    true,
  );

  assert.match(
    findThreat(
      ".zip",
      makeZip([
        { name: "setup.exe", content: "x" },
        { name: "../../escape.txt", content: "x" },
      ]),
    ),
    /unsafe path/,
  );

  assert.match(
    findThreat(
      ".zip",
      makeZip([
        { name: "setup.exe", content: "x" },
        { name: "notes.txt", content: program },
      ]),
    ),
    /hidden program/,
  );

  assert.match(
    findThreat(
      ".zip",
      makeZip([
        { name: "locked.txt", content: "x", flags: 1 },
        { name: "huge.txt", content: "a", declaredSize: 50 * 1024 * 1024 },
      ]),
    ),
    /zip bomb/,
  );

  assert.match(
    findThreat(
      ".zip",
      makeZip([
        { name: "inner.zip", content: makeZip([]) },
        { name: "test.txt", content: Buffer.from(eicarText) },
      ]),
    ),
    /virus test signature/,
  );

  const damaged = makeZip([{ name: "setup.exe", content: "x" }]).subarray(0, -5);
  assert.equal(canBeApproved(findThreat(".zip", damaged)), false);
});

test("ordinary photos are not mistaken for hidden scripts", () => {
  const jpeg = Buffer.from("ffd8ffe000104a464946", "hex");
  const photo = (extra) => Buffer.concat([jpeg, noise(4096), extra, noise(4096)]);

  assert.equal(findThreat(".jpg", photo(Buffer.from("<%@ "))), null);
  assert.equal(findThreat(".jpg", photo(Buffer.from("<?xml version"))), null);
  assert.equal(findThreat(".jpg", photo(Buffer.from("<scripting guide"))), null);

  assert.match(findThreat(".jpg", photo(Buffer.from("<%@ page language='java'"))), /script code/);
  assert.match(findThreat(".jpg", photo(Buffer.from("<SCRIPT>x"))), /script code/);
  assert.match(findThreat(".gif", Buffer.concat([Buffer.from("GIF89a"), Buffer.from("<ScRiPt src=x>")])), /script code/);
  assert.match(findThreat(".jpg", photo(Buffer.from("<?PHP echo 1;"))), /script code/);
});

test("harmless names and text files inside an archive are not flagged", () => {
  assert.equal(
    findThreat(".zip", makeZip([{ name: "notes.txt", content: "#! heading style note" }])),
    null,
  );
  assert.equal(
    findThreat(".zip", makeZip([{ name: "Meeting 10:30.txt", content: "agenda" }])),
    null,
  );
  assert.match(
    findThreat(".zip", makeZip([{ name: "tool", content: "#!/bin/sh\necho hi" }])),
    /hidden program/,
  );
  assert.match(
    findThreat(".zip", makeZip([{ name: "C:/escape.txt", content: "x" }])),
    /unsafe path/,
  );
});

test("many archive entries are checked quickly", () => {
  const filler = Buffer.from("quarterly evidence notes ".repeat(6000));
  const zip = makeZip(
    Array.from({ length: 500 }, (_, index) => ({
      name: "f" + index + ".txt",
      content: filler,
      deflate: true,
    })),
  );
  const started = Date.now();
  assert.equal(findThreat(".zip", zip), null);
  assert.ok(Date.now() - started < 1500);
});

test("every approvable reason has advice and final reasons have none", () => {
  for (const reason of [
    "the archive contains a program, script or macro file",
    "the archive contains another archive",
    "the archive contains an encrypted file which cannot be checked",
    "the document contains macros",
    "the PDF contains scripts, launch actions or embedded files",
    "the RTF document contains an embedded object",
    "the spreadsheet contains a command formula",
  ]) {
    assert.equal(canBeApproved(reason), true);
    assert.ok(adviceFor(reason).length > 40, reason);
  }

  for (const reason of [
    "it contains a known virus test signature",
    "the antivirus engine found Win.Test.EICAR_HDB-1",
    "something else",
    "",
    undefined,
  ]) {
    assert.equal(adviceFor(reason), "");
  }
});

test("a PDF report quotes the start of what it found", () => {
  const plain = inspectFile(
    ".pdf",
    Buffer.from("%PDF-1.4\n<< /S /Launch /F (cmd.exe) /Win << /P (/c calc) >> >>\n<< /S /JavaScript /JS (app.alert(1)) >>"),
  ).preview.items;

  assert.match(plain.join("|"), /\/Launch found 1 time\. The first one reads: "\/Launch \/F \(cmd\.exe\)/);
  assert.match(plain.join("|"), /\/JavaScript found 1 time\. The first one reads: "\/JavaScript \/JS \(app\.alert\(1\)\)/);

  const hidden = Buffer.concat([
    Buffer.from("%PDF-1.5\n5 0 obj\n<< /Type /ObjStm /Filter /FlateDecode >>\nstream\n"),
    zlib.deflateSync(Buffer.from("6 0 << /S /JavaScript /JS (secret()) >>")),
    Buffer.from("\nendstream\n"),
  ]);
  assert.match(
    inspectFile(".pdf", hidden).preview.items.join("|"),
    /hidden inside compressed data\)\. The first one reads: "\/JavaScript \/JS \(secret\(\)\)/,
  );

  const long = inspectFile(
    ".pdf",
    Buffer.from("%PDF-1.4\n/Launch " + "x".repeat(5000)),
  ).preview.items[0];
  assert.ok(long.length < 250);

  const control = inspectFile(
    ".pdf",
    Buffer.from("%PDF-1.4\n/Launch \u0001\u0002 end"),
  ).preview.items[0];
  assert.equal(/[\u0000-\u001f]/.test(control), false);
});

function pngOfSize(width, height) {
  const header = Buffer.alloc(25);
  header.writeUInt32BE(13, 0);
  header.write("IHDR", 4, "latin1");
  header.writeUInt32BE(width, 8);
  header.writeUInt32BE(height, 12);
  return Buffer.concat([pngSignature, header, pngEnd]);
}

function jpegOfSize(width, height) {
  const frame = Buffer.alloc(19);
  frame.writeUInt16BE(17, 0);
  frame[2] = 8;
  frame.writeUInt16BE(height, 3);
  frame.writeUInt16BE(width, 5);
  const app = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14, 0x4a)]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app,
    Buffer.from([0xff, 0xc0]),
    frame,
    Buffer.from([0xff, 0xd9]),
  ]);
}

test("an image report shows the picture size for PNG, GIF and JPEG", () => {
  const size = (extension, data) => inspectFile(extension, data).preview.items[0];

  assert.equal(size(".png", pngOfSize(640, 480)), "Picture size: 640 x 480 pixels");

  const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.from([0x20, 0x03, 0x58, 0x02]), Buffer.alloc(10)]);
  assert.equal(size(".gif", gif), "Picture size: 800 x 600 pixels");

  assert.equal(size(".jpg", jpegOfSize(1920, 1080)), "Picture size: 1920 x 1080 pixels");
});

test("broken pictures never crash the report", () => {
  const broken = [
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngOfSize(0, 0),
    Buffer.from("GIF89a"),
    Buffer.from("ffd8ff", "hex"),
    Buffer.from("ffd8ffe00000", "hex"),
    Buffer.concat([Buffer.from("ffd8ffe00000", "hex"), Buffer.alloc(40)]),
    Buffer.concat([Buffer.from("ffd8ff", "hex"), Buffer.alloc(40, 0xff)]),
    Buffer.concat([Buffer.from("ffd8ffc0", "hex"), Buffer.alloc(6)]),
  ];

  for (const data of broken) {
    for (const extension of [".png", ".gif", ".jpg"]) {
      const items = inspectFile(extension, data).preview.items;
      assert.equal(items.some((item) => item.startsWith("Picture size")), false);
    }
  }

  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  const started = Date.now();
  for (let run = 0; run < 2000; run++) {
    const data = Buffer.alloc(20 + (next() % 200));
    for (let index = 0; index < data.length; index++) data[index] = next() & 0xff;
    data[0] = 0xff;
    data[1] = 0xd8;
    data[2] = 0xff;
    inspectFile(".jpg", data);
  }
  assert.ok(Date.now() - started < 3000);
});
