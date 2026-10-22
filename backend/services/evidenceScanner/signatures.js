const eicar = Buffer.from(
  [
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
    "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
    "$H+H*",
  ].join(""),
);

const dosStub = Buffer.from("This program cannot be run in DOS mode");

function startsWithShebang(head) {
  return head.subarray(0, 3).toString("latin1") === "#!/";
}

function startsLikeProgram(head) {
  if (head.length >= 4) {
    if (
      head[0] === 0x7f &&
      head[1] === 0x45 &&
      head[2] === 0x4c &&
      head[3] === 0x46
    ) {
      return true;
    }

    const magic = head.readUInt32BE(0);
    if (
      [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(
        magic,
      )
    ) {
      return true;
    }
  }

  if (startsWithShebang(head)) {
    return true;
  }

  if (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a) {
    if (head.includes(dosStub)) {
      return true;
    }

    if (head.length >= 0x40) {
      const offset = head.readUInt32LE(0x3c);
      if (offset + 4 <= head.length && head.readUInt32LE(offset) === 0x4550) {
        return true;
      }
    }
  }

  return false;
}

module.exports = { eicar, dosStub, startsWithShebang, startsLikeProgram };
