function saveEvidenceFile(data, filename, browser = window) {
  const url = browser.URL.createObjectURL(data);
  const link = browser.document.createElement("a");
  link.href = url;
  link.download = filename;
  browser.document.body.appendChild(link);
  link.click();
  link.remove();
  browser.setTimeout(() => browser.URL.revokeObjectURL(url), 1000);
}

function evidenceShareData(data, file, resultTitle, browser) {
  if (typeof browser.File !== "function") {
    return null;
  }

  const sharedFile = new browser.File([data], file.filename, {
    type: file.mimetype || data.type || "application/octet-stream",
  });
  return {
    title: `Evidence for ${resultTitle}`,
    text: file.note || `Evidence file: ${file.filename}`,
    files: [sharedFile],
  };
}

function canShareEvidenceFile(data, file, resultTitle, browser = window) {
  if (
    typeof browser.navigator.share !== "function" ||
    typeof browser.navigator.canShare !== "function" ||
    typeof browser.File !== "function"
  ) {
    return false;
  }

  try {
    const shareData = evidenceShareData(data, file, resultTitle, browser);
    return browser.navigator.canShare(shareData);
  } catch {
    return false;
  }
}

async function shareEvidenceFile(data, file, resultTitle, browser = window) {
  let shareData;
  let canShare = false;

  try {
    shareData = evidenceShareData(data, file, resultTitle, browser);
    canShare =
      Boolean(shareData) &&
      typeof browser.navigator.share === "function" &&
      typeof browser.navigator.canShare === "function" &&
      browser.navigator.canShare(shareData);
  } catch {
    shareData = null;
  }

  if (canShare) {
    await browser.navigator.share(shareData);
    return true;
  }

  saveEvidenceFile(data, file.filename, browser);
  return false;
}

export { canShareEvidenceFile, saveEvidenceFile, shareEvidenceFile };
