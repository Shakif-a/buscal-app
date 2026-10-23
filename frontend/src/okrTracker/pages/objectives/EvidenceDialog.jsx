import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useSelector } from "react-redux";
import evidenceService from "../../features/objectives/keyResultService";
import {
  saveEvidenceFile,
  shareEvidenceFile,
} from "../../features/objectives/evidenceFiles";
import "./EvidenceDialog.css";

const maximumEvidenceSize = 5 * 1024 * 1024;
const maximumEvidenceFiles = 10;
const evidenceFileExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".heic",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".csv",
  ".txt",
  ".md",
  ".rtf",
  ".json",
  ".zip",
];

function displayFileSize(size) {
  if (!Number.isFinite(size) || size < 0) {
    return "Unknown size";
  }

  if (size < 1024 * 1024) {
    return Math.ceil(size / 1024) + " KB";
  }
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function displayFileType(filename) {
  if (typeof filename !== "string") {
    return "FILE";
  }

  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
}

const compressibleImageTypes = ["image/jpeg", "image/png", "image/webp"];

const unpreviewableImageTypes = ["image/heic", "image/heif"];

function isPreviewableMimetype(mimetype) {
  return (
    Boolean(mimetype) &&
    !unpreviewableImageTypes.includes(mimetype) &&
    (mimetype.startsWith("image/") || mimetype === "application/pdf")
  );
}

function compressEvidenceImage(file) {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 1920;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

      if (scale === 1) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: file.type }) : file),
        file.type,
        0.82,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    image.src = url;
  });
}

function prepareEvidenceFile(file) {
  if (!compressibleImageTypes.includes(file.type)) {
    return Promise.resolve(file);
  }
  return compressEvidenceImage(file);
}

function failureMessage(failure, fallback) {
  return failure.response?.data?.message || failure.message || fallback;
}

async function fileFailureMessage(failure, fallback) {
  const data = failure.response?.data;

  if (data && typeof data.text === "function") {
    try {
      const body = JSON.parse(await data.text());
      if (body.message) {
        return body.message;
      }
    } catch {
      return failure.message || fallback;
    }
  }

  return failureMessage(failure, fallback);
}

// Evidence popup for one key result, opened in "view" or "upload" mode.
// onChange runs after evidence is added, removed or restored so the caller can refresh.
function EvidenceDialog({ objectiveId, keyResult, initialMode, onClose, onChange }) {
  const token = useSelector((state) => state.auth.user?.token);
  const evidenceResult = keyResult;
  const [evidenceMode, setEvidenceMode] = useState(initialMode);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceQueue, setEvidenceQueue] = useState([]);
  const [evidenceDragging, setEvidenceDragging] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceAction, setEvidenceAction] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [evidenceMessageType, setEvidenceMessageType] = useState("info");
  const [evidenceDeleteTarget, setEvidenceDeleteTarget] = useState(null);
  const [evidenceUndoFile, setEvidenceUndoFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const evidenceDialogRef = useRef(null);
  const evidenceCloseRef = useRef(null);
  const evidencePreviewCloseRef = useRef(null);
  const evidenceDragDepth = useRef(0);
  const evidenceTriggerRef = useRef(document.activeElement);
  const evidenceUploadController = useRef(null);
  const evidenceNextQueueId = useRef(1);
  const evidenceFileInputId = `evidence-file-${objectiveId}`;
  const evidenceFileHelpId = `evidence-file-help-${objectiveId}`;
  const evidenceFileTypesId = `evidence-file-types-${objectiveId}`;
  const evidenceBusy = evidenceLoading || Boolean(evidenceAction);
  const evidenceQueuedCount = evidenceQueue.filter(
    (item) => item.status === "queued",
  ).length;

  // Load the saved files for the mode the popup opened in
  useEffect(() => {
    if (initialMode === "upload") {
      showEvidenceUpload(keyResult);
    } else {
      showEvidence(keyResult);
    }
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => evidenceCloseRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    return () => evidenceUploadController.current?.abort();
  }, []);

  useEffect(() => {
    if (!evidencePreview) {
      return;
    }
    window.requestAnimationFrame(() => evidencePreviewCloseRef.current?.focus());
  }, [evidencePreview]);

  useEffect(() => {
    if (evidenceBusy || evidencePreview) {
      return;
    }

    if (!evidenceDialogRef.current?.contains(document.activeElement)) {
      evidenceCloseRef.current?.focus();
    }
  }, [evidenceBusy, evidencePreview]);

  function closeEvidence() {
    if (evidenceAction) {
      return;
    }
    const trigger = evidenceTriggerRef.current;
    clearEvidenceQueue();
    closeEvidencePreview();
    onClose();
    window.requestAnimationFrame(() => trigger?.focus());
  }

  function handleEvidenceKeyDown(event) {
    if (event.key === "Escape" && !evidenceAction) {
      event.preventDefault();
      // Don't let Escape also close a popup this one was opened from
      event.stopPropagation();
      closeEvidence();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const controls = Array.from(
      evidenceDialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) || [],
    );

    if (controls.length === 0) {
      event.preventDefault();
      return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function showEvidence(result) {
    setEvidenceMode("view");
    setEvidenceFiles([]);
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceDeleteTarget(null);
    setEvidenceUndoFile(null);
    closeEvidencePreview();
    setEvidenceAction("");
    setEvidenceLoading(true);

    try {
      const files = await evidenceService.getEvidence(
        objectiveId,
        result._id || result.id,
        token,
      );
      setEvidenceFiles(files);
    } catch (failure) {
      setEvidenceError(failureMessage(failure, "Could not load evidence"));
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function showEvidenceUpload(result) {
    setEvidenceMode("upload");
    clearEvidenceQueue();
    setEvidenceDragging(false);
    evidenceDragDepth.current = 0;
    setEvidenceNote("");
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceDeleteTarget(null);
    setEvidenceUndoFile(null);
    closeEvidencePreview();
    setEvidenceAction("");
    setEvidenceLoading(true);

    try {
      const files = await evidenceService.getEvidence(
        objectiveId,
        result._id || result.id,
        token,
      );
      setEvidenceFiles(files);
    } catch (failure) {
      setEvidenceError(failureMessage(failure, "Could not load evidence"));
    } finally {
      setEvidenceLoading(false);
    }
  }

  function buildEvidenceQueueItem(file, overLimit) {
    const extension = file.name.includes(".")
      ? "." + file.name.split(".").pop().toLowerCase()
      : "";

    let error = "";
    if (overLimit) {
      error =
        "This key result already has 10 evidence files, which is the limit. Remove one before adding another.";
    } else if (!evidenceFileExtensions.includes(extension)) {
      error = "This file type is not supported";
    } else if (file.size === 0) {
      error = "This file is empty";
    } else if (file.size > maximumEvidenceSize) {
      error =
        "File is too large. Maximum size is 5 MB, this one is " +
        displayFileSize(file.size);
    }

    evidenceNextQueueId.current += 1;

    return {
      id: evidenceNextQueueId.current,
      file,
      status: error ? "error" : "queued",
      percent: 0,
      error,
      permanent: Boolean(error),
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    };
  }

  async function addEvidenceFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return;
    }

    setEvidenceMessage("");
    const prepared = await Promise.all(files.map(prepareEvidenceFile));
    const reservedSlots = evidenceFiles.length + evidenceQueue.filter(
      (item) => item.status !== "error",
    ).length;
    const remainingSlots = Math.max(0, maximumEvidenceFiles - reservedSlots);

    setEvidenceQueue((queue) => [
      ...queue,
      ...prepared.map((file, index) =>
        buildEvidenceQueueItem(file, index >= remainingSlots),
      ),
    ]);
  }

  function removeEvidenceQueueItem(id) {
    setEvidenceQueue((queue) => {
      const target = queue.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return queue.filter((item) => item.id !== id);
    });
  }

  function retryEvidenceQueueItem(id) {
    updateQueueItem(id, { status: "queued", percent: 0, error: "" });
  }

  function clearEvidenceQueue() {
    evidenceQueue.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setEvidenceQueue([]);
  }

  function updateQueueItem(id, changes) {
    setEvidenceQueue((queue) =>
      queue.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  function selectEvidenceFile(event) {
    addEvidenceFiles(event.target.files);
    event.target.value = "";
  }

  function startEvidenceDrag(event) {
    event.preventDefault();
    event.stopPropagation();

    if (evidenceBusy) {
      return;
    }

    evidenceDragDepth.current += 1;
    setEvidenceDragging(true);
  }

  function continueEvidenceDrag(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function endEvidenceDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    evidenceDragDepth.current = Math.max(0, evidenceDragDepth.current - 1);

    if (evidenceDragDepth.current === 0) {
      setEvidenceDragging(false);
    }
  }

  function dropEvidenceFile(event) {
    event.preventDefault();
    event.stopPropagation();
    evidenceDragDepth.current = 0;
    setEvidenceDragging(false);

    if (evidenceBusy) {
      return;
    }

    addEvidenceFiles(event.dataTransfer.files);
  }

  function pasteEvidenceFile(event) {
    if (evidenceMode !== "upload" || evidenceBusy) {
      return;
    }

    const files = Array.from(event.clipboardData?.files || []);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    addEvidenceFiles(files);
  }

  async function uploadEvidence(event) {
    event.preventDefault();

    const pending = evidenceQueue.filter((item) => item.status === "queued");
    if (pending.length === 0) {
      setEvidenceError("Please select a file to upload");
      return;
    }

    setEvidenceAction("upload");
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceUndoFile(null);

    let uploaded = 0;
    let cancelled = false;

    for (const item of pending) {
      if (cancelled) {
        break;
      }

      const controller = new AbortController();
      evidenceUploadController.current = controller;

      updateQueueItem(item.id, { status: "uploading", percent: 0 });

      try {
        await evidenceService.uploadEvidence(
          objectiveId,
          evidenceResult._id || evidenceResult.id,
          item.file,
          evidenceNote,
          token,
          controller.signal,
          (percent) => updateQueueItem(item.id, { percent }),
        );

        updateQueueItem(item.id, { status: "success", percent: 100 });
        uploaded += 1;
      } catch (failure) {
        if (failure.code === "ERR_CANCELED") {
          cancelled = true;
          updateQueueItem(item.id, { status: "queued", percent: 0 });
        } else {
          const message = failureMessage(failure, "Could not upload this file");
          updateQueueItem(item.id, {
            status: "error",
            percent: 0,
            error: message,
            permanent:
              message.startsWith("This file was blocked by the security scan") &&
              !message.includes("can approve it"),
          });
        }
      }

      evidenceUploadController.current = null;
    }

    setEvidenceAction("");
    setEvidenceQueue((queue) => {
      queue.forEach((item) => {
        if (item.status === "success" && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return queue.filter((item) => item.status !== "success");
    });

    if (cancelled) {
      setEvidenceMessageType("info");
      setEvidenceMessage(
        "Upload cancelled. The rest of your files are still ready to upload.",
      );
    } else if (uploaded > 0) {
      setEvidenceNote("");
        setEvidenceMessageType("success");
      setEvidenceMessage(
        uploaded === 1
          ? "Evidence uploaded successfully. Click View Evidence to download or share it."
          : uploaded +
              " files uploaded successfully. Click View Evidence to download or share them.",
      );
    }

    if (uploaded === 0) {
      return;
    }

    try {
      const files = await evidenceService.getEvidence(
        objectiveId,
        evidenceResult._id || evidenceResult.id,
        token,
      );
      setEvidenceFiles(files);
    } catch (failure) {
      const reason = failure.response?.data?.message || failure.message;
      setEvidenceError(
        "Evidence uploaded, but the saved files could not be refreshed" +
          (reason ? `: ${reason}` : ""),
      );
    }

    try {
      await onChange?.();
    } catch {
      setEvidenceError(
        "Evidence uploaded, but the objective details could not be refreshed",
      );
    }
  }

  function cancelEvidenceUpload() {
    evidenceUploadController.current?.abort();
  }

  async function getEvidenceFile(file) {
    return evidenceService.downloadEvidence(
      objectiveId,
      evidenceResult._id || evidenceResult.id,
      file._id || file.id,
      token,
    );
  }

  function canPreviewEvidenceFile(file) {
    return isPreviewableMimetype(file.mimetype);
  }

  async function previewEvidence(file) {
    const fileId = file._id || file.id;
    setEvidenceAction("preview-" + fileId);
    setEvidenceError("");
    try {
      const data = await getEvidenceFile(file);
      setEvidencePreview({
        file,
        url: URL.createObjectURL(data),
        revoke: true,
      });
    } catch (failure) {
      setEvidenceError(
        await fileFailureMessage(failure, "Could not preview evidence"),
      );
    } finally {
      setEvidenceAction("");
    }
  }

  function previewQueueItem(item) {
    const url = item.previewUrl || URL.createObjectURL(item.file);
    setEvidencePreview({
      file: { filename: item.file.name, mimetype: item.file.type },
      url,
      revoke: !item.previewUrl,
    });
  }

  function closeEvidencePreview() {
    if (evidencePreview?.revoke) {
      URL.revokeObjectURL(evidencePreview.url);
    }
    setEvidencePreview(null);
  }

  async function downloadEvidence(file) {
    const fileId = file._id || file.id;
    setEvidenceAction("download-" + fileId);
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceUndoFile(null);
    try {
      const data = await getEvidenceFile(file);
      saveEvidenceFile(data, file.filename);
      setEvidenceMessageType("success");
      setEvidenceMessage("Evidence downloaded successfully");
    } catch (failure) {
      setEvidenceError(
        await fileFailureMessage(failure, "Could not download evidence"),
      );
    } finally {
      setEvidenceAction("");
    }
  }

  async function shareEvidence(file) {
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceUndoFile(null);
    const fileId = file._id || file.id;
    setEvidenceAction("share-" + fileId);

    try {
      const data = await getEvidenceFile(file);
      const shared = await shareEvidenceFile(data, file, evidenceResult.name);

      if (shared) {
        setEvidenceMessageType("success");
        setEvidenceMessage("Evidence shared successfully");
      } else {
        setEvidenceMessageType("info");
        setEvidenceMessage(
          "Sharing is not available in this browser, so the file was downloaded",
        );
      }
    } catch (failure) {
      if (failure.name === "AbortError") {
        setEvidenceMessageType("info");
        setEvidenceMessage("Sharing was cancelled");
      } else {
        setEvidenceError(
          await fileFailureMessage(failure, "Could not share evidence"),
        );
      }
    } finally {
      setEvidenceAction("");
    }
  }

  async function deleteEvidence(file) {
    const fileId = file._id || file.id;
    setEvidenceAction("delete-" + fileId);
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceUndoFile(null);
    try {
      await evidenceService.deleteEvidence(
        objectiveId,
        evidenceResult._id || evidenceResult.id,
        file._id || file.id,
        token,
      );
      setEvidenceFiles((files) =>
        files.filter((item) => (item._id || item.id) !== (file._id || file.id)),
      );
        setEvidenceDeleteTarget(null);
      setEvidenceUndoFile(file);
      setEvidenceMessageType("success");
      setEvidenceMessage("Evidence deleted successfully");

      try {
        await onChange?.();
      } catch {
        setEvidenceError(
          "Evidence deleted, but the objective details could not be refreshed",
        );
      }
    } catch (failure) {
      setEvidenceError(failureMessage(failure, "Could not delete evidence"));
    } finally {
      setEvidenceAction("");
    }
  }

  async function undoDeleteEvidence() {
    const file = evidenceUndoFile;
    if (!file) {
      return;
    }

    const fileId = file._id || file.id;
    setEvidenceAction("restore-" + fileId);
    setEvidenceError("");
    try {
      await evidenceService.restoreEvidence(
        objectiveId,
        evidenceResult._id || evidenceResult.id,
        fileId,
        token,
      );
      setEvidenceFiles((files) => [file, ...files]);
      setEvidenceUndoFile(null);
      setEvidenceMessageType("info");
      setEvidenceMessage("Evidence restored");

      try {
        await onChange?.();
      } catch {
        setEvidenceError(
          "Evidence restored, but the objective details could not be refreshed",
        );
      }
    } catch (failure) {
      setEvidenceError(failureMessage(failure, "Could not restore evidence"));
    } finally {
      setEvidenceAction("");
    }
  }

  function askToDeleteEvidence(file) {
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceUndoFile(null);
    setEvidenceDeleteTarget(file._id || file.id);
  }

  function shareButtonText(file) {
    const fileId = file._id || file.id;
    const isWorking = evidenceAction === "share-" + fileId;

    return isWorking ? "Sharing..." : "Share File";
  }

  // Rendered on the body so a transformed parent (like an MUI modal) can't clip the overlay
  return createPortal(
    <div className="evidence-overlay">
      <section
        ref={evidenceDialogRef}
        className="evidence-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-dialog-title"
        onKeyDown={handleEvidenceKeyDown}
        onPaste={pasteEvidenceFile}
      >
        <div className="evidence-popup-header">
          <div>
            <h2 id="evidence-dialog-title">Key Result Evidence</h2>
            <p>{evidenceResult.name}</p>
          </div>
          <button
            ref={evidenceCloseRef}
            type="button"
            aria-label="Close evidence"
            onClick={closeEvidence}
            disabled={Boolean(evidenceAction)}
            autoFocus
          >
            <CloseIcon aria-hidden="true" />
          </button>
        </div>

        {evidenceError && <p role="alert">{evidenceError}</p>}
        {evidenceMessage && (
          <div
            className={`evidence-message evidence-message-${evidenceMessageType}`}
            role="status"
          >
            {evidenceMessageType === "success" ? (
              <CheckCircleOutlineIcon aria-hidden="true" />
            ) : (
              <InfoOutlinedIcon aria-hidden="true" />
            )}
            <p>{evidenceMessage}</p>
            {evidenceUndoFile && (
              <button
                type="button"
                className="evidence-undo-button"
                onClick={undoDeleteEvidence}
                disabled={evidenceBusy}
              >
                Undo
              </button>
            )}
          </div>
        )}

        {evidencePreview ? (
          <div className="evidence-preview-panel">
            <div className="evidence-preview-header">
              <strong>{evidencePreview.file.filename}</strong>
              <button
                ref={evidencePreviewCloseRef}
                type="button"
                onClick={closeEvidencePreview}
                aria-label="Close preview"
              >
                <CloseIcon aria-hidden="true" />
              </button>
            </div>
            {evidencePreview.file.mimetype.startsWith("image/") ? (
              <img
                className="evidence-preview-image"
                src={evidencePreview.url}
                alt={evidencePreview.file.filename}
              />
            ) : (
              <iframe
                className="evidence-preview-frame"
                src={evidencePreview.url}
                title={evidencePreview.file.filename}
              />
            )}
          </div>
        ) : evidenceMode === "upload" ? (
          <form className="evidence-upload-form" onSubmit={uploadEvidence}>
            <div className="evidence-file-field">
              <span className="evidence-field-label">Files</span>
              <label
                className={`evidence-drop-zone${
                  evidenceDragging ? " is-dragging" : ""
                }${evidenceQueue.length > 0 ? " has-file" : ""}${
                  evidenceBusy ? " is-disabled" : ""
                }`}
                htmlFor={evidenceFileInputId}
                onDragEnter={startEvidenceDrag}
                onDragOver={continueEvidenceDrag}
                onDragLeave={endEvidenceDrag}
                onDrop={dropEvidenceFile}
              >
                <input
                  id={evidenceFileInputId}
                  className="evidence-file-input"
                  aria-label="Evidence files"
                  aria-describedby={`${evidenceFileHelpId} ${evidenceFileTypesId}`}
                  type="file"
                  multiple
                  accept={evidenceFileExtensions.join(",")}
                  onChange={selectEvidenceFile}
                  disabled={evidenceBusy}
                />
                {evidenceDragging ? (
                  <div className="evidence-drop-prompt" aria-live="polite">
                    <FileUploadOutlinedIcon aria-hidden="true" />
                    <strong>Drop the files here</strong>
                    <span>
                      They will be ready for you to review before upload.
                    </span>
                  </div>
                ) : (
                  <div className="evidence-drop-prompt">
                    <FileUploadOutlinedIcon aria-hidden="true" />
                    <strong>
                      You can drag and drop files here to add them
                    </strong>
                    <span>or click to choose files, or paste an image</span>
                  </div>
                )}
              </label>
              <div
                id={evidenceFileHelpId}
                className="evidence-file-help"
              >
                <span>Maximum file size: 5 MB per file</span>
                <span>
                  {evidenceFiles.length} of {maximumEvidenceFiles} evidence
                  files used
                </span>
              </div>
            </div>

            {evidenceQueue.length > 0 && (
              <ul className="evidence-queue-list">
                {evidenceQueue.map((item) => (
                  <li
                    key={item.id}
                    className={`evidence-queue-item evidence-queue-${item.status}`}
                  >
                    <div className="evidence-queue-summary">
                      {item.previewUrl ? (
                        <img
                          className="evidence-queue-thumb"
                          src={item.previewUrl}
                          alt=""
                        />
                      ) : (
                        <InsertDriveFileOutlinedIcon aria-hidden="true" />
                      )}
                      <div className="evidence-queue-details">
                        {isPreviewableMimetype(item.file.type) ? (
                          <button
                            type="button"
                            className="evidence-file-name-button"
                            onClick={() => previewQueueItem(item)}
                            disabled={evidenceBusy}
                          >
                            {item.file.name}
                          </button>
                        ) : (
                          <strong>{item.file.name}</strong>
                        )}
                        <span>
                          {displayFileType(item.file.name)} ·{" "}
                          {displayFileSize(item.file.size)}
                        </span>
                      </div>
                      {item.status === "error" && !item.permanent && (
                        <button
                          type="button"
                          className="evidence-queue-retry"
                          onClick={() => retryEvidenceQueueItem(item.id)}
                          disabled={evidenceBusy}
                        >
                          Retry
                        </button>
                      )}
                      {(item.status === "queued" ||
                        item.status === "error") && (
                        <button
                          type="button"
                          className="evidence-queue-remove"
                          aria-label={`Remove ${item.file.name}`}
                          onClick={() => removeEvidenceQueueItem(item.id)}
                          disabled={evidenceBusy}
                        >
                          <CloseIcon aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {(item.status === "uploading" ||
                      item.status === "success") && (
                      <div className="evidence-progress-track">
                        <div
                          className="evidence-progress-fill"
                          style={{ width: `${item.percent}%` }}
                        >
                          <span>
                            {item.status === "uploading" &&
                            item.percent >= 99
                              ? "Scanning and saving..."
                              : `${item.percent}% Complete`}
                          </span>
                        </div>
                        {item.status === "success" && (
                          <span className="evidence-progress-check">
                            <CheckCircleOutlineIcon aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    )}

                    {item.status === "error" && (
                      <p
                        className="evidence-queue-error-message"
                        role="alert"
                      >
                        <InfoOutlinedIcon aria-hidden="true" />
                        {item.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div
              id={evidenceFileTypesId}
              className="evidence-accepted-types"
            >
              <strong>Accepted file types:</strong>
              <div>
                <span>PDF</span>
                <span>Images</span>
                <span>Office</span>
                <span>OpenDocument</span>
                <span>ZIP</span>
                <span>JSON</span>
                <span>Text</span>
              </div>
            </div>
            <label>
              <span className="evidence-note-label">
                <span>Note (optional)</span>
                <span>{evidenceNote.length}/1000</span>
              </span>
              <textarea
                maxLength="1000"
                value={evidenceNote}
                onChange={(event) => setEvidenceNote(event.target.value)}
                disabled={evidenceBusy}
              />
            </label>
            <div className="evidence-popup-actions">
              {evidenceAction === "upload" ? (
                <button type="button" onClick={cancelEvidenceUpload}>
                  Cancel upload
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => showEvidence(evidenceResult)}
                  disabled={evidenceBusy}
                >
                  View Evidence
                </button>
              )}
              <button
                type="submit"
                className="evidence-primary-button"
                disabled={evidenceBusy || evidenceQueuedCount === 0}
              >
                {evidenceAction === "upload"
                  ? "Uploading..."
                  : evidenceQueuedCount > 1
                    ? `Upload ${evidenceQueuedCount} Files`
                    : "Upload Evidence"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {evidenceLoading ? (
              <p className="evidence-loading" role="status">
                Loading evidence...
              </p>
            ) : evidenceFiles.length === 0 ? (
              <div className="evidence-empty-state">
                <InsertDriveFileOutlinedIcon aria-hidden="true" />
                <strong>No evidence yet</strong>
                <span>Upload a file to support this key result.</span>
              </div>
            ) : (
              <ul className="evidence-list">
                {evidenceFiles.map((file) => (
                  <li key={file._id || file.id}>
                    <div className="evidence-file-summary">
                      <div className="evidence-file-icon">
                        <InsertDriveFileOutlinedIcon aria-hidden="true" />
                      </div>
                      <div className="evidence-file-details">
                        {canPreviewEvidenceFile(file) ? (
                          <button
                            type="button"
                            className="evidence-file-name-button"
                            onClick={() => previewEvidence(file)}
                            disabled={evidenceBusy}
                          >
                            {file.filename}
                          </button>
                        ) : (
                          <strong>{file.filename}</strong>
                        )}
                        <span className="evidence-file-meta">
                          {evidenceAction === "preview-" + (file._id || file.id)
                            ? "Opening preview... · "
                            : ""}
                          {displayFileType(file.filename)} ·{" "}
                          {displayFileSize(file.size)}
                          {file.uploadedByName
                            ? ` · Uploaded by ${file.uploadedByName}`
                            : ""}
                        </span>
                        {file.note && (
                          <p className="evidence-file-note">
                            <strong>Note</strong>
                            {file.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="evidence-file-actions">
                      <button
                        type="button"
                        className="evidence-share-button"
                        onClick={() => shareEvidence(file)}
                        disabled={evidenceBusy}
                        aria-label={`Share ${file.filename}`}
                      >
                        <ShareOutlinedIcon aria-hidden="true" />
                        {shareButtonText(file)}
                      </button>
                      <button
                        type="button"
                        className="evidence-download-button"
                        onClick={() => downloadEvidence(file)}
                        disabled={evidenceBusy}
                        aria-label={`Download ${file.filename}`}
                      >
                        <DownloadOutlinedIcon aria-hidden="true" />
                        {evidenceAction ===
                        "download-" + (file._id || file.id)
                          ? "Downloading..."
                          : "Download"}
                      </button>
                      <button
                        type="button"
                        className="evidence-delete-button"
                        onClick={() => askToDeleteEvidence(file)}
                        disabled={evidenceBusy}
                        aria-label={`Delete ${file.filename}`}
                      >
                        <DeleteOutlineIcon aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                    {evidenceDeleteTarget === (file._id || file.id) && (
                      <div
                        className="evidence-delete-confirmation"
                        aria-live="polite"
                      >
                        <div className="evidence-delete-copy">
                          <span className="evidence-delete-icon">
                            <DeleteOutlineIcon aria-hidden="true" />
                          </span>
                          <div>
                            <strong>Remove this evidence?</strong>
                            <span>
                              {file.filename} will be permanently removed.
                            </span>
                          </div>
                        </div>
                        <div className="evidence-delete-confirmation-actions">
                          <button
                            type="button"
                            className="evidence-keep-button"
                            onClick={() => setEvidenceDeleteTarget(null)}
                            disabled={evidenceBusy}
                            autoFocus
                          >
                            Keep file
                          </button>
                          <button
                            type="button"
                            className="evidence-remove-button"
                            onClick={() => deleteEvidence(file)}
                            disabled={evidenceBusy}
                          >
                            {evidenceAction ===
                            "delete-" + (file._id || file.id)
                              ? "Removing..."
                              : "Remove file"}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="evidence-popup-actions evidence-list-footer">
              <button
                type="button"
                className="evidence-upload-another"
                onClick={() => showEvidenceUpload(evidenceResult)}
                disabled={evidenceBusy}
              >
                <UploadFileOutlinedIcon aria-hidden="true" />
                {evidenceFiles.length === 0
                  ? "Upload evidence"
                  : "Upload another"}
              </button>
              <button
                type="button"
                className="evidence-primary-button"
                onClick={closeEvidence}
                disabled={evidenceBusy}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

export default EvidenceDialog;
