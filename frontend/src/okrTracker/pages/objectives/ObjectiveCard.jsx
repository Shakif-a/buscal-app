import { useEffect, useRef, useState } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useDispatch, useSelector } from "react-redux";
import { deleteObjective, getObjectives, updateObjective } from "../../features/objectives/objectiveSlice";
import { createKeyResult, updateKeyResult, deleteKeyResult } from "../../features/keyResults/keyResultSlice";
import keyResultService from "../../features/keyResults/keyResultService";
import { getAllUsers } from "../../features/users/userSlice";
import objectiveService from "../../features/objectives/objectiveService";
import evidenceService from "../../features/objectives/keyResultService";
import {
  saveEvidenceFile,
  shareEvidenceFile,
} from "../../features/objectives/evidenceFiles";

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

// Backend status values matched to UI labels
const API_TO_UI_STATUS = {
  "not started": "Not Started",
  "in-progress": "In Progress",
  "on-track": "On Track",
  "at-risk": "At Risk",
  "overdue": "Overdue",
  "awaiting-approval": "Awaiting Approval",
  "completed": "Completed",
};
// Frontend labels to backend values
const UI_TO_API_STATUS = {
  "Not Started": "not started",
  "In Progress": "in-progress",
  "On Track": "on-track",
  "At Risk": "at-risk",
  "Overdue": "overdue",
  "Awaiting Approval": "awaiting-approval",
  "Completed": "completed",
};

const STATUS_COLOURS = {
  "not-started": "#9ca3af",
  "in-progress": "#72cdf4",
  "on-track": "#72cdf4",
  "at-risk": "#f4b400",
  overdue: "#e57373",
  "awaiting-approval": "#1f1e40",
  completed: "#00b085",
};

const getStatusColour = (status) => {
  const normalisedStatus = status
    ?.toLowerCase()
    .replace(/\s+/g, "-");
  //STATUS_COLOURS[status?.toLowerCase().replace(/\s+/g, "-")] || "#72cdf4";

  //const colourKey = normalisedStatus === "on track" ? "on-track" : normalisedStatus;

  return STATUS_COLOURS[normalisedStatus] || "#72cdf4"
};
// Map a backend KR to the this component shape
function mapKeyResult(kr) {
  return {
    id: kr._id || kr.id,
    name: kr.title || "",
    weight: kr.weight ?? 0,
    assigned: kr.assigned || "Unassigned",
    // Populated objects returned as: _id, firstName, lastName
    assignedTo: kr.assignedTo?._id || kr.assignedTo || null,
    progress: kr.progress ?? 0,
    dueDate: kr.dueDate ? new Date(kr.dueDate).toISOString().split("T")[0] : "",
    status: API_TO_UI_STATUS[kr.status] || "Choose Progress",
    approved: kr.approved || false,
    canManageEvidence: !!kr.canManageEvidence,
    canEdit: !!kr.canEdit,
    canEditProgress: !!kr.canEditProgress,
    canApprove: !!kr.canApprove,
  };
}

// Validate before send to backend. Undefined is dropped.
function buildKeyResultPayload(kr) {
  return {
    title: kr.name.trim(),
    weight: Number(kr.weight),
    dueDate: kr.dueDate,
    assignedTo: kr.assignedTo || null,
    progress: Number(kr.progress) || 0,
    status: UI_TO_API_STATUS[kr.status], // undefined for "Choose Progress", backend default applies
    approved: kr.approved,
  };
}

function isKeyResultComplete(kr) {
  return (
    kr.name.trim() !== "" &&
    Number(kr.weight) > 0 &&
    !!kr.assignedTo &&
    kr.dueDate !== ""
  );
}

function ObjectiveCard({ objective }) {
  const objectiveId = objective.id || objective._id;

  //Objective Status integration is completed
  const objectiveStatus = objective.status || "not started";
  const objectiveProgress = objective.progress ?? 0;

  const objectiveStatusLabel = objectiveStatus
    ? API_TO_UI_STATUS[objectiveStatus] || objectiveStatus
    : "Not Started";
  
  const objectiveStatusColour = getStatusColour(objectiveStatus);

  // Objective
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editCommitmentType, setEditCommitmentType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [groupOptions, setGroupOptions] = useState([]);

  // Key results
  const [showKeyResults, setShowKeyResults] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [keyResults, setKeyResults] = useState([]);
  const [originalKeyResults, setOriginalKeyResults] = useState([]);

  // Evidence
  const [evidenceResult, setEvidenceResult] = useState(null);
  const [evidenceMode, setEvidenceMode] = useState("");
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
  const evidenceTriggerRef = useRef(null);
  const evidenceUploadController = useRef(null);
  const evidenceNextQueueId = useRef(1);
  const evidenceFileInputId = `evidence-file-${objectiveId}`;
  const evidenceFileHelpId = `evidence-file-help-${objectiveId}`;
  const evidenceFileTypesId = `evidence-file-types-${objectiveId}`;
  const evidenceBusy = evidenceLoading || Boolean(evidenceAction);
  const evidenceQueuedCount = evidenceQueue.filter(
    (item) => item.status === "queued",
  ).length;

  // Weight popup
  const [showWeightPopup, setShowWeightPopup] = useState(false);
  const [weightDrafts, setWeightDrafts] = useState([]);

  // Menu and delete
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const menuRef = useRef(null);

  // Redux
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.user?.token);
  const { users: employees } = useSelector((state) => state.users);

  // Fetch real user objects when in edit mode
  useEffect(() => {
    if ((editMode || showEditModal) && token) {
      dispatch(getAllUsers(token));
    }
  }, [editMode, showEditModal, token, dispatch]);

  // Fetch objective's key results
  async function fetchKeyResults() {
    try {
      const data = await keyResultService.getKeyResultsByObjective(objectiveId, token);
      setKeyResults(data.map(mapKeyResult));
    } catch (err) {
      console.error("Error fetching KRs:", err);
    }
  }

  useEffect(() => {
    if (showKeyResults && objectiveId) {
      fetchKeyResults();
    }
  }, [showKeyResults, objectiveId, token]);

  // Click outside menu = close
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    if (!evidencePreview) {
      return;
    }
    window.requestAnimationFrame(() => evidencePreviewCloseRef.current?.focus());
  }, [evidencePreview]);

  useEffect(() => {
    if (!evidenceResult || evidenceBusy || evidencePreview) {
      return;
    }

    if (!evidenceDialogRef.current?.contains(document.activeElement)) {
      evidenceCloseRef.current?.focus();
    }
  }, [evidenceResult, evidenceBusy, evidencePreview]);

  function closeEvidence() {
    if (evidenceAction) {
      return;
    }
    const trigger = evidenceTriggerRef.current;
    setEvidenceResult(null);
    setEvidenceMode("");
    setEvidenceFiles([]);
    clearEvidenceQueue();
    setEvidenceDragging(false);
    evidenceDragDepth.current = 0;
    setEvidenceNote("");
    setEvidenceLoading(false);
    setEvidenceAction("");
    setEvidenceError("");
    setEvidenceMessage("");
    setEvidenceDeleteTarget(null);
    setEvidenceUndoFile(null);
    closeEvidencePreview();
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
    rememberEvidenceTrigger();
    setEvidenceResult(result);
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
      await dispatch(getObjectives()).unwrap();
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
        await dispatch(getObjectives()).unwrap();
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

  // Groups from the database
  async function loadGroupOptions() {
    try {
      const groups = await objectiveService.getObjectiveGroups(token);
      setGroupOptions(Array.isArray(groups) ? groups : groups.groups || []);
    } catch (err) {
      console.error("Error fetching groups:", err);
    }
  }

  // Open objective edit
  function openEditModal() {
    setEditTitle(objective.title || "");
    setEditOwner(objective.owner?._id || objective.owner || "");
    setEditGroup(objective.group || "");
    setEditCommitmentType(objective.commitmentType || "committed");
    setEditDescription(objective.description || "");

    if (objective.dueDate) {
      const date = new Date(objective.dueDate);
      setEditDueDate(date.toISOString().split("T")[0]);
    } else {
      setEditDueDate("");
    }

    setShowMenu(false);
    setShowEditModal(true);
    loadGroupOptions();
  }

  // Add new key result
  function addKeyResult() {
    const newKeyResult = {
      id: `new-${Date.now()}`,
      name: "",
      weight: 0,
      assigned: "Unassigned",
      assignedTo: null,
      progress: 0,
      dueDate: "",
      status: "Choose Progress",
      approved: false,
      isNew: true,
      canEdit: true,
      canEditProgress: true,
      canApprove: false,
      canManageEvidence: false,
    };

    setKeyResults([...keyResults, newKeyResult]);
    setEditMode(true);
  }

  // Update key result field(s) (local)
  function updateLocalKeyResult(id, changes) {
    setKeyResults((previous) =>
      previous.map((kr) => (kr.id === id ? { ...kr, ...changes } : kr))
    );
  }

  // Remove a key result. Existing ones are also deleted on backend.
  async function removeKeyResult(kr) {
    if (!kr.isNew) {
      try {
        await dispatch(
          deleteKeyResult({ objectiveId, keyResultId: kr.id })
        ).unwrap();
        await dispatch(getObjectives()).unwrap();
      } catch (err) {
        console.error("Failed to delete key result", err);
        return;
      }
    }
    setKeyResults((previous) => previous.filter((item) => item.id !== kr.id));
  }

  // Enter edit mode/save changes
  async function handleEditButton() {
    if (!editMode) {
      setOriginalKeyResults(keyResults.map((kr) => ({ ...kr })));
      setEditMode(true);
      return;
    }

    try {
      for (const kr of keyResults) {
        if (kr.isNew) {
          await dispatch(
            createKeyResult({
              objectiveId,
              keyResultData: buildKeyResultPayload(kr),
            })
          ).unwrap();
        } else {
          const original = originalKeyResults.find((o) => o.id === kr.id);
          if (original && JSON.stringify(kr) !== JSON.stringify(original)) {
            await dispatch(
              updateKeyResult({
                objectiveId,
                keyResultId: kr.id,
                keyResultData: Object.fromEntries( //send only saved fields
                  Object.entries(buildKeyResultPayload(kr)).filter(
                    ([field, value]) => {
                      const originalPayload = buildKeyResultPayload(original);
                      return value !== originalPayload[field];
                    }
                  )
                ),
              })
            ).unwrap();
          }
        }
      }

      // Pull fresh data. New KRs get real _ids + not flagged as isNew
      await fetchKeyResults();
      //pull updated objective
      await dispatch(getObjectives()).unwrap();
      setEditMode(false);
      setOriginalKeyResults([]);
    } catch (err) {
      console.error("Failed to save key results", err);
    }
  }

  // Calc total weight
  const totalKeyResultWeight = keyResults.reduce(
    (total, kr) => total + Number(kr.weight),
    0
  );

  const allKeyResultsComplete = keyResults.every(isKeyResultComplete);

  // Can the user change other KRs?
  // Used to stop assignies from getting error messages when trying to save when they can't change the other broken KRs
  const canChangeStructure =
    objective.canCreateKeyResult || objective.canEditKeyResults;

  // Are the key results valid for saving? Either no KRs, or user cant change structure, or all KRs complete and total weight = 100
  const keyResultsValid =
    keyResults.length === 0 ||
    !canChangeStructure ||
    (allKeyResultsComplete && totalKeyResultWeight === 100);

  // Check if user can edit any key result so we know if to show the edit button
  const canEditAnyKeyResult =
    objective.canCreateKeyResult ||
    objective.canEditKeyResults ||
    objective.canApproveKeyResult ||
    keyResults.some((kr) => kr.canEditProgress);

  // Delete objective
  const handleDeleteObjective = async () => {
    try {
      await dispatch(deleteObjective(objectiveId)).unwrap();
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete objective", error);
    }
  };

  // Update objective
  const handleUpdateObjective = async () => {
    try {
      const objectiveData = {
        title: editTitle,
        dueDate: editDueDate,
        owner: editOwner,
        group: editGroup,
        commitmentType: editCommitmentType,
        description: editDescription,
      };

      await dispatch(updateObjective({ objectiveId, objectiveData })).unwrap();
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update objective", error);
    }
  };

  // Weight popup
  const openWeightPopup = () => {
    setWeightDrafts(
      keyResults.map((kr) => ({ id: kr.id, weight: kr.weight }))
    );
    setShowWeightPopup(true);
  };

  const handleWeightChange = (id, newWeight) => {
    const weight = Math.max(0, Math.min(100, Number(newWeight)));

    setWeightDrafts((previous) =>
      previous.map((item) => (item.id === id ? { ...item, weight } : item))
    );
  };

  const totalWeight = weightDrafts.reduce(
    (total, item) => total + Number(item.weight),
    0
  );

  const closeWeightPopup = () => {
    setShowWeightPopup(false);
    setWeightDrafts([]);
  };

  const saveWeights = () => {
    if (totalWeight !== 100) return;

    setKeyResults((previous) =>
      previous.map((kr) => {
        const draft = weightDrafts.find((item) => item.id === kr.id);
        return draft ? { ...kr, weight: draft.weight } : kr;
      })
    );
    setShowWeightPopup(false);
    setWeightDrafts([]);
  };

  return (
    <div
      className="objective-card"
      style={{
        borderLeft: `6px solid ${objectiveStatusColour}`,
      }}
    >
      {/* Objective information */}
      <div className="objective-details">
        <div className="objective-info">
          <h3 className="objective-title">{objective.title}</h3>

          <p>
            Group: <strong>{objective.group}</strong>
          </p>

          <p>
            Owner: <strong>{objective.manager}</strong>
          </p>

          <p>
            Type: <strong>{objective.type}</strong>
          </p>

          <p>
            Status: <strong style={{ color: objectiveStatusColour}}>{objectiveStatusLabel}</strong>
          </p>
        </div>

        <p className="objective-due-date">
          Due: <strong>
            {objective.dueDate
              ? new Date(objective.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
              : "No due date"}
          </strong>
        </p>
        {objective.canManage && (
        <div className="objective-menu-container" ref={menuRef}>
          <button
            type="button"
            className="objective-menu-button"
            onClick={() => setShowMenu(!showMenu)}
          >
            ...
          </button>
          {showMenu && (
            <div className="objective-menu-dropdown">
              <button
                type="button"
                className="objective-menu-item"
                onClick={openEditModal}
              >
                Edit
              </button>
              <button
                type="button"
                className="objective-menu-item delete-menu-item"
                onClick={() => {
                  setShowMenu(false);
                  setShowDeleteModal(true);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      <hr />
      {/* Progress section */}
      <div className="progress-section">
        <button
          type="button"
          className="progress-button"
          onClick={() => setShowKeyResults(!showKeyResults)}
        >
          {showKeyResults ? "Hide Key Results" : "View Key Results"}
        </button>

        <div className="progress-area">
          <div className="progress-labels">
            {[25, 50, 75, 100].map((percentage) => (
              <span
                key={percentage}
                className="progress-label"
                style={{ left: `${percentage}%`}}
              >
                {percentage}%
              </span>
            ))}
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${objectiveProgress}%` }}
            />

            <div
              className="progress-circle"
              style={{ left: `${objectiveProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Key Results Table */}
      {showKeyResults && (
        <div className="key-results-section">
          <table className="key-results-table">
            <thead>
              <tr>
                <th>KEY RESULTS <span className="required">*</span></th>
                <th>WEIGHT <span className="required">*</span></th>
                <th>ASSIGNED <span className="required">*</span></th>
                <th>DUE DATE <span className="required">*</span></th>
                <th>PROGRESS</th>
                <th>STATUS</th>
                <th>EVIDENCE</th>
                <th>APPROVAL</th>
              </tr>
            </thead>

            <tbody>
              {keyResults.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-key-results">
                    No Key Results have been found. Select "Edit Key Results" to add a Key Result.
                  </td>
                </tr>
              ) : (
                keyResults.map((keyResult) => (
                  <tr
                    key={keyResult.id}
                    className="key-result-row"
                    style={{
                      "--status-colour": getStatusColour(keyResult.status),
                    }}
                  >

                    {/* Key Result name */}
                    <td>
                      {editMode && keyResult.canEdit && (
                        <button
                          type="button"
                          className="remove-key-result"
                          onClick={() => removeKeyResult(keyResult)}
                        >
                          −
                        </button>
                      )}

                      {editMode && keyResult.canEdit ? (
                        <input
                          className="key-result-name-input"
                          type="text"
                          placeholder="Enter Key Result"
                          value={keyResult.name}
                          onChange={(event) =>
                            updateLocalKeyResult(keyResult.id, { name: event.target.value })
                          }
                        />
                      ) : (
                        <span>{keyResult.name}</span>
                      )}
                    </td>

                    {/* Weight */}
                    <td>
                      {editMode && keyResult.canEdit ? (
                        <button
                          type="button"
                          className="weight-edit-link"
                          onClick={openWeightPopup}
                        >
                          <span>{keyResult.weight}%</span>
                          <EditIcon className="weight-edit-icon" />
                        </button>
                      ) : (
                        <span>{keyResult.weight}%</span>
                      )}
                    </td>

                    {/* Assigned: real users, stores the user _id */}
                    <td>
                      {editMode && keyResult.canEdit ? (
                        <select
                          value={keyResult.assignedTo || ""}
                          onChange={(event) => {
                            const selectedId = event.target.value;
                            const selectedUser = employees.find(
                              (employee) => employee._id === selectedId
                            );
                            updateLocalKeyResult(keyResult.id, {
                              assignedTo: selectedId || null,
                              assigned: selectedUser
                                ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim()
                                : "Unassigned",
                            });
                          }}
                        >
                          <option value="">Assign Employee</option>
                          {employees.map((employee) => (
                            <option key={employee._id} value={employee._id}>
                              {employee.firstName} {employee.lastName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        keyResult.assigned
                      )}
                    </td>

                    {/* Due Date */}
                    <td>
                      {editMode && keyResult.canEdit ? (
                        <input
                          className="date-input"
                          type="date"
                          value={keyResult.dueDate}
                          onChange={(event) =>
                            updateLocalKeyResult(keyResult.id, { dueDate: event.target.value })
                          }
                        />
                      ) : (
                        keyResult.dueDate
                      )}
                    </td>

                    {/* Progress */}
                    <td>
                      {editMode && keyResult.canEditProgress ? (
                        <input
                          className="key-result-small-input"
                          type="number"
                          min="0"
                          max="100"
                          value={keyResult.progress}
                          onChange={(event) =>
                            updateLocalKeyResult(keyResult.id, {
                              progress: Number(event.target.value),
                            })
                          }
                        />
                      ) : (
                        `${keyResult.progress}%`
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <select
                        className={`status-select ${keyResult.status.toLowerCase().replace(/ /g, "-")}`}
                        value={keyResult.status}
                        disabled={!editMode || !(keyResult.canEdit || keyResult.canEditProgress)}
                        onChange={(event) =>
                          updateLocalKeyResult(keyResult.id, { status: event.target.value })
                        }
                      >
                        <option value="Choose Progress" disabled={!keyResult.canEdit}>Choose Progress</option>
                        <option value="In Progress" disabled={!keyResult.canEdit}>In Progress</option>
                        <option value="At Risk" disabled={!keyResult.canEdit}>At Risk</option>
                        <option value="Overdue" disabled={!keyResult.canEdit}>Overdue</option>
                        <option 
                          value="Awaiting Approval"
                          disabled={
                            Number(keyResult.progress) !== 100 ||
                            keyResult.approved ||
                            !(keyResult.canEdit || keyResult.canEditProgress)
                          }
                        >
                            Awaiting Approval
                        </option>
                        <option value="Completed" disabled={!keyResult.canEdit || !keyResult.approved}
                        >
                          Completed
                        </option>
                      </select>
                    </td>

                    {/* Evidence */}
                    <td>
                      {keyResult.canManageEvidence ? (
                        <>
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => showEvidence(keyResult)}
                          >
                            View
                          </button>

                          <span> | </span>

                          <button
                            type="button"
                            className="action-link"
                            onClick={() => showEvidenceUpload(keyResult)}
                          >
                            Upload
                          </button>
                        </>
                      ) : (
                        <span title="Only the person assigned to this key result, or a manager of the objective, can view or upload evidence">
                          Not available
                        </span>
                      )}
                    </td>

                    {/* Approval */}
                    <td>
                      <input
                        type="checkbox"
                        checked={keyResult.approved}
                        disabled={!editMode || !objective.canApproveKeyResult}
                        onChange={(event) => {
                          if (!editMode || !objective.canApproveKeyResult) return;

                          const isApproved = event.target.checked;


                          updateLocalKeyResult(keyResult.id, {
                            approved: isApproved,
                            ...(isApproved && {status: "Completed"}),
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="key-results-footer">
            <div className="key-results-footer-left">
              {editMode && objective.canCreateKeyResult && (
                <button
                  type="button"
                  className="add-key-result"
                  onClick={addKeyResult}
                >
                  + Add Key Result
                </button>
              )}

              {editMode && canChangeStructure && keyResults.length > 0 && (
                <>
                  {!allKeyResultsComplete && (
                    <p className="key-result-validation">
                      Key Results Title, Weight, Assigned Employee and Due Date are required fields.
                    </p>
                  )}

                  {totalKeyResultWeight !== 100 && (
                    <p className="key-result-validation">
                      Combined Key Result Weight must equal 100%
                      <br />
                      Current total: {totalKeyResultWeight}%
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="footer-buttons">
              {editMode && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setKeyResults(originalKeyResults);
                    setEditMode(false);
                    setShowWeightPopup(false);
                    setWeightDrafts([]);
                  }}
                >
                  Cancel
                </button>
              )}

              {canEditAnyKeyResult && (
                <button
                  type="button"
                  className="save-button"
                  onClick={handleEditButton}
                  disabled={editMode && !keyResultsValid}
                >
                  {editMode ? "Save Key Results" : "Edit Key Results"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weight Popup */}
      {showWeightPopup && (
        <div className="weight-popup-overlay">
          <div className="weight-popup">
            <div className="weight-popup-header">
              <h3>Edit Key Result Weights</h3>

              <button
                type="button"
                className="weight-popup-close"
                onClick={closeWeightPopup}
              >
                x
              </button>

              <p className="weight-popup-objective">
                Objective:
                <strong> {objective.title}</strong>
              </p>

              <p className="weight-popup-description">
                Combined Weighting Must Equal 100%
              </p>
            </div>

            <div className="weight-popup-content">
              {keyResults.map((keyResult) => {
                const draft = weightDrafts.find((item) => item.id === keyResult.id);
                const currentWeight = draft?.weight ?? keyResult.weight;

                return (
                  <div className="weight-slider-item" key={keyResult.id}>
                    <div className="weight-slider-info">
                      <span className="weight-slider-title">{keyResult.name}</span>
                      <span className="weight-slider-employee">- {keyResult.assigned}</span>
                    </div>

                    <div className="weight-slider-controls">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={currentWeight}
                        onChange={(e) => handleWeightChange(keyResult.id, e.target.value)}
                        className="weight-slider"
                      />

                      <div className="weight-slider-percentage">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={currentWeight}
                          onChange={(e) => handleWeightChange(keyResult.id, e.target.value)}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="weight-total">
              <span>Total Weight</span>
              <strong className={totalWeight === 100 ? "weight-total-valid" : "weight-total-invalid"}>
                {totalWeight}%
              </strong>
            </div>

            <div className="weight-popup-buttons">
              <button type="button" className="cancel-button" onClick={closeWeightPopup}>
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                disabled={totalWeight !== 100}
                onClick={saveWeights}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Popup */}
      {evidenceResult && (
        <div className="popup-overlay">
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
        </div>
      )}

      {/* Delete Objective Popup */}
      {showDeleteModal && (
        <div className="popup-overlay">
          <div className="delete-objective-popup">
            <h2>Delete Objective</h2>
            <p>
              Are you sure you want to delete <strong>{objective.title}</strong>?
            </p>
            <p>This action cannot be undone.</p>

            <div className="popup-buttons">
              <button
                type="button"
                className="popup-cancel-button"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="popup-delete-button"
                onClick={handleDeleteObjective}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Objective Popup */}
      {showEditModal && (
        <div className="edit-popup-overlay">
          <div className="edit-objective-popup">
            <div className="edit-popup-header">
              <h2>Edit Objective</h2>

              <button
                type="button"
                className="edit-popup-close"
                onClick={() => setShowEditModal(false)}
              >
                x
              </button>
            </div>

            <div className="edit-objective-form">
              <div className="edit-form-left">
                <label>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter Objective Title"
                />

                <label>Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />

                <label>Owner</label>
                <select
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                >
                  <option value="">Select owner</option>
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.firstName} {employee.lastName}
                    </option>
                  ))}
                </select>

                <label>Group</label>
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                >
                  <option value="">Select group</option>
                  {editGroup && !groupOptions.includes(editGroup) && (
                    <option value={editGroup}>{editGroup}</option>
                  )}
                  {groupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>

                <label>Type</label>
                <select
                  value={editCommitmentType}
                  onChange={(e) => setEditCommitmentType(e.target.value)}
                >
                  <option value="committed">Committed</option>
                  <option value="aspirational">Aspirational</option>
                </select>
              </div>

              <div className="edit-form-right">
                <label>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe the Objective"
                />
              </div>
            </div>

            <div className="edit-popup-buttons">
              <button
                type="button"
                className="edit-cancel-button"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="edit-save-button"
                onClick={handleUpdateObjective}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ObjectiveCard;