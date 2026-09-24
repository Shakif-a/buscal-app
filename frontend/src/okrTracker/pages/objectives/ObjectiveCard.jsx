import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import {
  canShareEvidenceFile,
  saveEvidenceFile,
  shareEvidenceFile,
} from "../../features/objectives/evidenceFiles";
import keyResultService from "../../features/objectives/keyResultService";
import { getObjectives } from "../../features/objectives/objectiveSlice";
import ObjectiveActions from "./ObjectiveActions";

const maximumEvidenceSize = 5 * 1024 * 1024;
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

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : "";
}

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

function ObjectiveCard({ objective }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [evidenceResult, setEvidenceResult] = useState(null);
  const [evidenceMode, setEvidenceMode] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceDragging, setEvidenceDragging] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceAction, setEvidenceAction] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [evidenceMessageType, setEvidenceMessageType] = useState("info");
  const [preparedShare, setPreparedShare] = useState(null);
  const [evidenceDeleteTarget, setEvidenceDeleteTarget] = useState(null);
  const evidenceDialogRef = useRef(null);
  const evidenceCloseRef = useRef(null);
  const evidenceDragDepth = useRef(0);
  const evidenceTriggerRef = useRef(null);
  const evidenceUploadController = useRef(null);
  const keyResults = objective.keyResults || [];
  const objectiveId = objective._id || objective.id;
  const evidenceFileInputId = `evidence-file-${objectiveId}`;
  const evidenceFileHelpId = `evidence-file-help-${objectiveId}`;
  const evidenceFileTypesId = `evidence-file-types-${objectiveId}`;
  const evidenceBusy = evidenceLoading || Boolean(evidenceAction);

  useEffect(() => {
    if (!evidenceResult) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => evidenceCloseRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [evidenceResult]);

  useEffect(() => {
    return () => evidenceUploadController.current?.abort();
  }, []);

  async function addKeyResult(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await keyResultService.create(
        objectiveId,
        { title, weight: Number(weight), dueDate },
        user.token,
      );
      setAdding(false);
      setTitle("");
      setWeight("");
      setDueDate("");
      await dispatch(getObjectives()).unwrap();
    } catch (failure) {
      setError(failureMessage(failure, "Could not save key result"));
    } finally {
      setSaving(false);
    }
  }

  async function changeApproval(result) {
    setSaving(true);
    setError("");
    try {
      await keyResultService.approve(
        objectiveId,
        result._id || result.id,
        !result.approved,
        user.token,
      );
      await dispatch(getObjectives()).unwrap();
    } catch (failure) {
      setError(failureMessage(failure, "Could not update approval"));
    } finally {
      setSaving(false);
    }
  }

  function closeEvidence() {
    if (evidenceAction) {
      return;
    }
    const trigger = evidenceTriggerRef.current;
    setEvidenceResult(null);
    setEvidenceMode("");
    setEvidenceFiles([]);
    setEvidenceFile(null);
    setEvidenceDragging(false);
    evidenceDragDepth.current = 0;
    setEvidenceNote("");
    setEvidenceLoading(false);
    setEvidenceAction("");
    setEvidenceError("");
    setEvidenceMessage("");
    setPreparedShare(null);
    setEvidenceDeleteTarget(null);
    evidenceTriggerRef.current = null;
    window.requestAnimationFrame(() => trigger?.focus());
  }

  function rememberEvidenceTrigger() {
    if (!evidenceResult) {
      evidenceTriggerRef.current = document.activeElement;
    }
  }

  function handleEvidenceKeyDown(event) {
    if (event.key === "Escape" && !evidenceAction) {
      event.preventDefault();
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
    rememberEvidenceTrigger();
    setEvidenceResult(result);
    setEvidenceMode("view");
    setEvidenceFiles([]);
    setEvidenceError("");
    setEvidenceMessage("");
    setPreparedShare(null);
    setEvidenceDeleteTarget(null);
    setEvidenceAction("");
    setEvidenceLoading(true);

    try {
      const files = await keyResultService.getEvidence(
        objectiveId,
        result._id || result.id,
        user.token,
      );
      setEvidenceFiles(files);
    } catch (failure) {
      setEvidenceError(failureMessage(failure, "Could not load evidence"));
    } finally {
      setEvidenceLoading(false);
    }
  }

  function showEvidenceUpload(result) {
    rememberEvidenceTrigger();
    setEvidenceResult(result);
    setEvidenceMode("upload");
    setEvidenceFile(null);
    setEvidenceDragging(false);
    evidenceDragDepth.current = 0;
    setEvidenceNote("");
    setEvidenceError("");
    setEvidenceMessage("");
    setPreparedShare(null);
    setEvidenceDeleteTarget(null);
    setEvidenceAction("");
    setEvidenceLoading(false);
  }

  function setEvidenceFileSelection(file) {
    setEvidenceFile(null);
    setEvidenceError("");
    setEvidenceMessage("");

    if (!file) {
      return;
    }

    const extension = file.name.includes(".")
      ? "." + file.name.split(".").pop().toLowerCase()
      : "";

    if (!evidenceFileExtensions.includes(extension)) {
      setEvidenceError("This file type is not supported");
      return;
    }

    if (file.size === 0) {
      setEvidenceError("Please select a file that is not empty");
      return;
    }

    if (file.size > maximumEvidenceSize) {
      setEvidenceError("Evidence files cannot be larger than 5 MB");
      return;
    }

    setEvidenceFile(file);
  }

  function selectEvidenceFile(event) {
    setEvidenceFileSelection(event.target.files[0] || null);
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

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 1) {
      setEvidenceFile(null);
      setEvidenceMessage("");
      setEvidenceError("Please upload one evidence file at a time");
      return;
    }

    setEvidenceFileSelection(files[0] || null);
  }

  async function uploadEvidence(event) {
    event.preventDefault();

    if (!evidenceFile) {
      setEvidenceError("Please select a file to upload");
      return;
    }

    setEvidenceAction("upload");
    setEvidenceError("");
    setEvidenceMessage("");

    const controller = new AbortController();
    evidenceUploadController.current = controller;

    try {
      await keyResultService.uploadEvidence(
        objectiveId,
        evidenceResult._id || evidenceResult.id,
        evidenceFile,
        evidenceNote,
        user.token,
        controller.signal,
      );
      setEvidenceFile(null);
      setEvidenceNote("");
      setEvidenceMode("view");
      setPreparedShare(null);
      setEvidenceMessageType("success");
      setEvidenceMessage(
        "Evidence uploaded successfully. You can download or share it below.",
      );
    } catch (failure) {
      if (failure.code === "ERR_CANCELED") {
        setEvidenceMessageType("info");
        setEvidenceMessage(
          "Upload cancelled. Your selected file is ready to retry.",
        );
      } else {
        setEvidenceError(failureMessage(failure, "Could not upload evidence"));
      }
      setEvidenceAction("");
      evidenceUploadController.current = null;
      return;
    }

    evidenceUploadController.current = null;

    try {
      const files = await keyResultService.getEvidence(
        objectiveId,
        evidenceResult._id || evidenceResult.id,
        user.token,
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
      await dispatch(getObjectives()).unwrap();
    } catch {
      setEvidenceError(
        "Evidence uploaded, but the objective details could not be refreshed",
      );
    }
    setEvidenceAction("");
  }

  function cancelEvidenceUpload() {
    evidenceUploadController.current?.abort();
  }

  async function getEvidenceFile(file) {
    return keyResultService.downloadEvidence(
      objectiveId,
      evidenceResult._id || evidenceResult.id,
      file._id || file.id,
      user.token,
    );
  }

  async function downloadEvidence(file) {
    const fileId = file._id || file.id;
    setEvidenceAction("download-" + fileId);
    setEvidenceError("");
    setEvidenceMessage("");
    setPreparedShare(null);
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
    const fileId = file._id || file.id;
    const prepared = preparedShare?.id === fileId ? preparedShare : null;
    setEvidenceAction("share-" + fileId);

    try {
      if (prepared) {
        const shared = await shareEvidenceFile(
          prepared.data,
          file,
          evidenceResult.title,
        );

        if (shared) {
          setEvidenceMessageType("success");
          setEvidenceMessage("Evidence shared successfully");
          setPreparedShare(null);
        } else {
          setEvidenceMessageType("info");
          setEvidenceMessage(
            "Sharing is not available in this browser, so the file was downloaded",
          );
          setPreparedShare(null);
        }
      } else {
        const data = await getEvidenceFile(file);

        if (canShareEvidenceFile(data, file, evidenceResult.title)) {
          setPreparedShare({ id: fileId, data });
          setEvidenceMessageType("info");
          setEvidenceMessage(
            "The file is ready. Select Choose Platform to share it",
          );
        } else {
          saveEvidenceFile(data, file.filename);
          setEvidenceMessageType("info");
          setEvidenceMessage(
            "Sharing is not available in this browser, so the file was downloaded",
          );
        }
      }
    } catch (failure) {
      if (failure.name === "AbortError") {
        setEvidenceMessageType("info");
        setEvidenceMessage(
          "Sharing was cancelled. Select Choose Platform when you are ready",
        );
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
    setPreparedShare(null);
    try {
      await keyResultService.deleteEvidence(
        objectiveId,
        evidenceResult._id || evidenceResult.id,
        file._id || file.id,
        user.token,
      );
      setEvidenceFiles((files) =>
        files.filter((item) => (item._id || item.id) !== (file._id || file.id)),
      );
      setPreparedShare(null);
      setEvidenceDeleteTarget(null);
      setEvidenceMessageType("success");
      setEvidenceMessage("Evidence deleted successfully");

      try {
        await dispatch(getObjectives()).unwrap();
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

  function askToDeleteEvidence(file) {
    setEvidenceError("");
    setEvidenceMessage("");
    setPreparedShare(null);
    setEvidenceDeleteTarget(file._id || file.id);
  }

  function shareButtonText(file) {
    const fileId = file._id || file.id;
    const isWorking = evidenceAction === "share-" + fileId;
    const isPrepared = preparedShare?.id === fileId;

    if (isWorking) {
      return isPrepared ? "Opening..." : "Preparing...";
    }

    return isPrepared ? "Choose Platform" : "Share File";
  }

  return (
    <div className="objective-card">
      <div className="objective-details">
        <div className="objective-info">
          <h3 className="objective-title">{objective.title}</h3>
          <p>
            Group: <strong>{objective.group}</strong>
          </p>
          <p>
            Objective Manager:{" "}
            <strong>{objective.manager || "Unassigned"}</strong>
          </p>
          <p>
            Type: <strong>{objective.type}</strong>
          </p>
        </div>
        <p className="objective-due-date">
          Due: <strong>{displayDate(objective.dueDate)}</strong>
        </p>
        {objective.canManage && <ObjectiveActions objective={objective} />}
      </div>
      <div className="progress-section">
        <button
          type="button"
          className="progress-button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide Key Results" : "View Key Results"}
        </button>
        <progress
          aria-label="Objective progress"
          max="100"
          value={objective.progress || 0}
        />
        <span>{objective.progress || 0}%</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {expanded && (
        <div className="key-results-section">
          {keyResults.length === 0 ? (
            <p>No key results yet.</p>
          ) : (
            <table className="key-results-table">
              <thead>
                <tr>
                  <th>Key result</th>
                  <th>Weight</th>
                  <th>Assigned to</th>
                  <th>Progress</th>
                  <th>Due date</th>
                  <th>Approval</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {keyResults.map((result) => (
                  <tr key={result._id || result.id}>
                    <td>{result.title}</td>
                    <td>{result.weight}%</td>
                    <td>{result.assigned || "Unassigned"}</td>
                    <td>{result.progress}%</td>
                    <td>{displayDate(result.dueDate)}</td>
                    <td>
                      {objective.canApproveKeyResult ? (
                        <button
                          disabled={saving}
                          onClick={() => changeApproval(result)}
                        >
                          {result.approved ? "Revoke approval" : "Approve"}
                        </button>
                      ) : result.approved ? (
                        "Approved"
                      ) : (
                        "Pending"
                      )}
                    </td>
                    <td>
                      {result.canManageEvidence ? (
                        <div className="evidence-buttons">
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => showEvidence(result)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => showEvidenceUpload(result)}
                          >
                            Upload
                          </button>
                        </div>
                      ) : (
                        "Not available"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {objective.canCreateKeyResult && (
            <button disabled={saving} onClick={() => setAdding(!adding)}>
              {adding ? "Cancel" : "Add Key Result"}
            </button>
          )}
          {adding && (
            <form onSubmit={addKeyResult}>
              <label>
                Title{" "}
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={saving}
                />
              </label>
              <label>
                Weight{" "}
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  step="any"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  disabled={saving}
                />
              </label>
              <label>
                Due date{" "}
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={saving}
                />
              </label>
              <button disabled={saving}>
                {saving ? "Saving..." : "Save Key Result"}
              </button>
            </form>
          )}
        </div>
      )}
      {evidenceResult && (
        <div className="popup-overlay">
          <section
            ref={evidenceDialogRef}
            className="evidence-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-dialog-title"
            onKeyDown={handleEvidenceKeyDown}
          >
            <div className="evidence-popup-header">
              <div>
                <h2 id="evidence-dialog-title">Key Result Evidence</h2>
                <p>{evidenceResult.title}</p>
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
              </div>
            )}

            {evidenceMode === "upload" ? (
              <form className="evidence-upload-form" onSubmit={uploadEvidence}>
                <div className="evidence-file-field">
                  <span className="evidence-field-label">Files</span>
                  <label
                    className={`evidence-drop-zone${
                      evidenceDragging ? " is-dragging" : ""
                    }${evidenceFile ? " has-file" : ""}${
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
                      aria-label="Evidence file"
                      aria-describedby={`${evidenceFileHelpId} ${evidenceFileTypesId}`}
                      type="file"
                      accept={evidenceFileExtensions.join(",")}
                      onChange={selectEvidenceFile}
                      disabled={evidenceBusy}
                    />
                    {evidenceDragging ? (
                      <div className="evidence-drop-prompt" aria-live="polite">
                        <FileUploadOutlinedIcon aria-hidden="true" />
                        <strong>Drop the file here</strong>
                        <span>
                          It will be ready for you to review before upload.
                        </span>
                      </div>
                    ) : evidenceFile ? (
                      <div className="evidence-selected-file" role="status">
                        <InsertDriveFileOutlinedIcon aria-hidden="true" />
                        <div>
                          <strong>{evidenceFile.name}</strong>
                          <span>
                            {displayFileType(evidenceFile.name)} ·{" "}
                            {displayFileSize(evidenceFile.size)}
                          </span>
                          <span>Drop another file or click to replace it.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="evidence-drop-prompt">
                        <FileUploadOutlinedIcon aria-hidden="true" />
                        <strong>
                          You can drag and drop a file here to add it
                        </strong>
                        <span>or click to choose a file</span>
                      </div>
                    )}
                  </label>
                  <div
                    id={evidenceFileHelpId}
                    className="evidence-file-help"
                  >
                    <span>Maximum file size: 5 MB · 1 file per upload</span>
                    <span>Up to 10 active evidence files per key result</span>
                  </div>
                </div>
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
                    disabled={evidenceBusy || !evidenceFile}
                  >
                    {evidenceAction === "upload"
                      ? "Uploading..."
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
                            <strong>{file.filename}</strong>
                            <span className="evidence-file-meta">
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
        </div>
      )}
    </div>
  );
}

export default ObjectiveCard;
