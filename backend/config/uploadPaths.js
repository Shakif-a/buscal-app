const fs = require("fs");
const path = require("path");

const sharedUploadsDir = path.resolve(__dirname, "../../../uploads");
const visitorPhotosDir = path.join(sharedUploadsDir, "visitor-photos");
const tempDir = path.join(sharedUploadsDir, "temp");
const reportsDir = path.join(sharedUploadsDir, "reports");
const pdfConversionDir = path.join(tempDir, "pdf-conversion");
const contractorDocsDir = path.join(sharedUploadsDir, "contractor-docs");

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return dirPath;
};

const getUploadedFilePath = (fileName) => path.join(sharedUploadsDir, fileName);
const getTempFilePath = (fileName) => path.join(tempDir, fileName);

module.exports = {
  sharedUploadsDir,
  visitorPhotosDir,
  tempDir,
  reportsDir,
  pdfConversionDir,
  contractorDocsDir,
  ensureDirectoryExists,
  getUploadedFilePath,
  getTempFilePath,
};
