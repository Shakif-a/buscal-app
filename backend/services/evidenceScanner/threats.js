const reviewableThreats = {
  archiveProgram: "the archive contains a program, script or macro file",
  nestedArchive: "the archive contains another archive",
  encryptedEntry:
    "the archive contains an encrypted file which cannot be checked",
  macros: "the document contains macros",
  pdfActive: "the PDF contains scripts, launch actions or embedded files",
  rtfObject: "the RTF document contains an embedded object",
  csvFormula: "the spreadsheet contains a command formula",
};

const advice = {
  [reviewableThreats.archiveProgram]:
    "Programs and scripts inside archives are a common way to spread malware. Approve it only if you know where the archive came from and why it needs to contain them.",
  [reviewableThreats.nestedArchive]:
    "An archive inside an archive can hide files from scanners. Ask the sender to send the files directly if they can.",
  [reviewableThreats.encryptedEntry]:
    "The scan cannot see inside a password protected file. Ask the sender for an unprotected copy unless you trust where it came from.",
  [reviewableThreats.macros]:
    "Macros can run code when the document is opened. Approve it only if the sender confirms the macros are theirs and are needed.",
  [reviewableThreats.pdfActive]:
    "Some forms and invoices use scripts for buttons and calculations, but scripts can also start harmful actions. Check the details below and approve it only if they look expected.",
  [reviewableThreats.rtfObject]:
    "An embedded object can open another program. Ask the sender whether the document really needs one.",
  [reviewableThreats.csvFormula]:
    "A spreadsheet program can run a formula like this when the file is opened. Ask the sender to remove it.",
};

function canBeApproved(threat) {
  return Object.hasOwn(advice, threat);
}

function adviceFor(threat) {
  return advice[threat] || "";
}

module.exports = { reviewableThreats, canBeApproved, adviceFor };
