const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const path = require("path");
const OkrEvidence = require("../models/okrEvidenceModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const OkrObjective = require("../models/okrObjectiveModel");
const writes = require("../services/okrWrites");
const { canUserManageObjective } = require("../middleware/okrPermissions");
const { generateNotifications } = require("./notificationController");

const allowedFileTypes = {
  ".csv": ["text/csv", "application/vnd.ms-excel"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".gif": ["image/gif"],
  ".heic": ["image/heic", "image/heif"],
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".json": ["application/json", "text/json"],
  ".md": ["text/markdown", "text/plain"],
  ".odp": ["application/vnd.oasis.opendocument.presentation"],
  ".ods": ["application/vnd.oasis.opendocument.spreadsheet"],
  ".odt": ["application/vnd.oasis.opendocument.text"],
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".rtf": ["application/rtf", "text/rtf"],
  ".txt": ["text/plain"],
  ".webp": ["image/webp"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".zip": ["application/zip", "application/x-zip-compressed"],
};

function startsWith(data, signature, offset = 0) {
  return (
    data.length >= offset + signature.length &&
    data.subarray(offset, offset + signature.length).equals(signature)
  );
}

function hasZipSignature(data) {
  return (
    startsWith(data, Buffer.from("504b0304", "hex")) ||
    startsWith(data, Buffer.from("504b0506", "hex")) ||
    startsWith(data, Buffer.from("504b0708", "hex"))
  );
}

function hasExpectedContents(extension, data) {
  if (extension === ".pdf") return startsWith(data, Buffer.from("%PDF-"));
  if (extension === ".png")
    return startsWith(data, Buffer.from("89504e470d0a1a0a", "hex"));
  if (extension === ".jpg" || extension === ".jpeg")
    return startsWith(data, Buffer.from("ffd8ff", "hex"));
  if (extension === ".gif")
    return (
      startsWith(data, Buffer.from("GIF87a")) ||
      startsWith(data, Buffer.from("GIF89a"))
    );
  if (extension === ".webp")
    return (
      startsWith(data, Buffer.from("RIFF")) &&
      startsWith(data, Buffer.from("WEBP"), 8)
    );
  if (extension === ".heic")
    return (
      startsWith(data, Buffer.from("ftypheic"), 4) ||
      startsWith(data, Buffer.from("ftypheix"), 4) ||
      startsWith(data, Buffer.from("ftypmif1"), 4)
    );
  if ([".doc", ".xls", ".ppt"].includes(extension))
    return startsWith(data, Buffer.from("d0cf11e0a1b11ae1", "hex"));
  if (
    [".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".zip"].includes(
      extension,
    )
  )
    return hasZipSignature(data);
  if (extension === ".rtf") return startsWith(data, Buffer.from("{\\rtf"));
  if (extension === ".json") {
    try {
      JSON.parse(data.toString("utf8"));
      return true;
    } catch {
      return false;
    }
  }
  if ([".csv", ".md", ".txt"].includes(extension)) {
    return !data.includes(0);
  }
  return true;
}

function fail(res, status, message) {
  res.status(status);
  throw new Error(message);
}

function readHeader(req, name, res) {
  const value = req.get(name);

  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value).trim();
  } catch {
    fail(res, 400, "Evidence details are not valid");
  }
}

function validateFile(req, res) {
  const filename = readHeader(req, "X-Evidence-Name", res);
  const mimetype = readHeader(req, "X-Evidence-Type", res).toLowerCase();
  const note = readHeader(req, "X-Evidence-Note", res);

  if (!filename || filename.length > 255 || /[\\/\0\r\n]/.test(filename)) {
    fail(res, 400, "Please select a file with a valid name");
  }

  if (note.length > 1000) {
    fail(res, 400, "Evidence notes cannot be longer than 1000 characters");
  }

  const extension = path.extname(filename).toLowerCase();
  const knownExtension = allowedFileTypes[extension];
  const genericFile = mimetype === "application/octet-stream";
  if (!knownExtension || (!genericFile && !knownExtension.includes(mimetype))) {
    fail(res, 400, "This file type is not supported");
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    fail(res, 400, "Please select a file to upload");
  }

  if (!hasExpectedContents(extension, req.body)) {
    fail(res, 400, "The file contents do not match the selected file type");
  }

  return {
    filename,
    mimetype: genericFile ? knownExtension[0] : mimetype,
    note,
  };
}

function validateIds(req, res, includeEvidence = false) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    fail(res, 404, "Objective not found");
  }

  if (!mongoose.isObjectIdOrHexString(req.params.keyResultId)) {
    fail(res, 404, "Key result not found");
  }

  if (
    includeEvidence &&
    !mongoose.isObjectIdOrHexString(req.params.evidenceId)
  ) {
    fail(res, 404, "Evidence not found");
  }
}

async function loadTarget(req, res, session, lockObjective = false) {
  const objective = lockObjective
    ? await writes.lockObjective(req.params.id, session)
    : await OkrObjective.findById(req.params.id, null, { session });

  if (!objective) {
    fail(res, 404, "Objective not found");
  }

  const keyResult = await OkrKeyResult.findOne(
    { _id: req.params.keyResultId, objective: objective._id },
    null,
    { session },
  );

  if (!keyResult) {
    fail(res, 404, "Key result not found");
  }

  const assignedId = keyResult.assignedTo && keyResult.assignedTo.toString();
  const isAssigned = assignedId === req.user._id.toString();
  const canManage = await canUserManageObjective(req.user, objective, session);

  if (!isAssigned && !canManage) {
    fail(res, 403, "You do not have permission to access this evidence");
  }

  return { objective, keyResult };
}

function evidenceData(evidence) {
  const data = evidence.toObject();
  data.id = data._id.toString();

  if (data.uploadedBy) {
    const firstName = data.uploadedBy.firstName || "";
    const lastName = data.uploadedBy.lastName || "";
    data.uploadedByName = (firstName + " " + lastName).trim();
    data.uploadedBy = data.uploadedBy._id;
  }

  delete data.data;
  return data;
}

const maximumEvidenceFiles = 10;

const uploadEvidence = asyncHandler(async (req, res) => {
  validateIds(req, res);
  const file = validateFile(req, res);

  const result = await writes.transaction(async (session) => {
    const target = await loadTarget(req, res, session, true);

    const existingCount = await OkrEvidence.countDocuments({
      keyResult: target.keyResult._id,
      deleted: { $ne: true },
    }).session(session);

    if (existingCount >= maximumEvidenceFiles) {
      fail(
        res,
        400,
        "This key result already has 10 evidence files, which is the limit. Remove one before adding another.",
      );
    }

    const evidence = new OkrEvidence({
      objective: target.objective._id,
      keyResult: target.keyResult._id,
      filename: file.filename,
      mimetype: file.mimetype,
      size: req.body.length,
      note: file.note,
      data: req.body,
      uploadedBy: req.user._id,
    });

    await evidence.save({ session });

    if (target.keyResult.approved) {
      target.keyResult.approved = false;
      target.keyResult.approvedBy = null;
      target.keyResult.approvedAt = null;
      await target.keyResult.save({ session });
    }

    return {
      evidence,
      objective: target.objective,
      keyResult: target.keyResult,
    };
  });

  await result.evidence.populate("uploadedBy", "firstName lastName");

  const ownerId = result.objective.owner && result.objective.owner.toString();
  if (ownerId && ownerId !== req.user._id.toString()) {
    try {
      await generateNotifications(
        [ownerId],
        `New evidence was added to "${result.keyResult.title}" on "${result.objective.title}" and now needs review.`,
        ["web"],
        "okr",
        "/dashboard/okrtracker/objectives",
      );
    } catch (error) {
      console.error("Could not create evidence notification:", error.message);
    }
  }

  res.status(201).json(evidenceData(result.evidence));
});

const getEvidence = asyncHandler(async (req, res) => {
  validateIds(req, res);
  await loadTarget(req, res);

  const evidence = await OkrEvidence.find({
    objective: req.params.id,
    keyResult: req.params.keyResultId,
    deleted: { $ne: true },
  })
    .populate("uploadedBy", "firstName lastName")
    .sort({ createdAt: -1 });

  res.json(evidence.map(evidenceData));
});

const downloadEvidence = asyncHandler(async (req, res) => {
  validateIds(req, res, true);
  await loadTarget(req, res);

  const evidence = await OkrEvidence.findOne({
    _id: req.params.evidenceId,
    objective: req.params.id,
    keyResult: req.params.keyResultId,
    deleted: { $ne: true },
  }).select("+data");

  if (!evidence) {
    fail(res, 404, "Evidence not found");
  }

  const fallbackName = evidence.filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encodedName = encodeURIComponent(evidence.filename).replace(
    /['()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );

  res.set("Content-Type", evidence.mimetype);
  res.set(
    "Content-Disposition",
    `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
  );
  res.set("Content-Length", String(evidence.data.length));
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.send(evidence.data);
});

const deleteEvidence = asyncHandler(async (req, res) => {
  validateIds(req, res, true);

  await writes.transaction(async (session) => {
    const target = await loadTarget(req, res, session, true);

    const evidence = await OkrEvidence.findOneAndUpdate(
      {
        _id: req.params.evidenceId,
        objective: req.params.id,
        keyResult: req.params.keyResultId,
        deleted: { $ne: true },
      },
      {
        deleted: true,
        deletedBy: req.user._id,
        deletedAt: new Date(),
      },
      { session },
    );

    if (!evidence) {
      fail(res, 404, "Evidence not found");
    }

    if (target.keyResult.approved) {
      target.keyResult.approved = false;
      target.keyResult.approvedBy = null;
      target.keyResult.approvedAt = null;
      await target.keyResult.save({ session });
    }
  });

  res.json({ id: req.params.evidenceId });
});

module.exports = {
  uploadEvidence,
  getEvidence,
  downloadEvidence,
  deleteEvidence,
};
