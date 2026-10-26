import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { useDispatch, useSelector } from "react-redux";
import { deleteObjective, getObjectives, updateObjective } from "../../features/objectives/objectiveSlice";
import { createKeyResult, updateKeyResult, deleteKeyResult } from "../../features/keyResults/keyResultSlice";
import keyResultService from "../../features/keyResults/keyResultService";
import { getAllUsers } from "../../features/users/userSlice";
import objectiveService from "../../features/objectives/objectiveService";
import EvidenceDialog from "./EvidenceDialog";

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
  // KRs can't be due after the objective
  const objectiveDueDay = objective.dueDate
    ? new Date(objective.dueDate).toISOString().split("T")[0]
    : undefined;
  const latestKeyResultDueDay = keyResults
    .map((kr) => kr.dueDate)
    .filter(Boolean)
    .sort()
    .pop();
  const [originalKeyResults, setOriginalKeyResults] = useState([]);

  // Evidence popup: the key result and whether it opened to view or upload
  const [evidenceTarget, setEvidenceTarget] = useState(null);

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

  // Users who can be assigned this objective's key results
  const [assignableUsers, setAssignableUsers] = useState([]);
  useEffect(() => {
    if (!editMode || !token) return;
    objectiveService
      .getAssignableUsers(objectiveId, token)
      .then(setAssignableUsers)
      .catch(() => setAssignableUsers([]));
  }, [editMode, token, objectiveId, objective.group]);

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
                            const selectedUser = assignableUsers.find(
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
                          {assignableUsers.map((employee) => (
                            <option key={employee._id} value={employee._id}>
                              {employee.firstName} {employee.lastName}
                            </option>
                          ))}
                          {keyResult.assignedTo &&
                            !assignableUsers.some((employee) => employee._id === keyResult.assignedTo) && (
                              <option value={keyResult.assignedTo}>{keyResult.assigned}</option>
                            )}
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
                          max={objectiveDueDay}
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
                            onClick={() => setEvidenceTarget({ keyResult, mode: "view" })}
                          >
                            View
                          </button>

                          <span> | </span>

                          <button
                            type="button"
                            className="action-link"
                            onClick={() => setEvidenceTarget({ keyResult, mode: "upload" })}
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
                        disabled={
                          !editMode ||
                          !objective.canApproveKeyResult ||
                          (
                            !keyResult.approved &&
                            (
                              Number(keyResult.progress) !== 100 ||
                              keyResult.status !== "Awaiting Approval"
                            )
                          )
                        }
                        title={
                          !keyResult.approved && Number(keyResult.progress) !== 100
                            ? "Key results can only be approved at 100% progress"
                            : undefined
                        }
                        onChange={(event) => {
                          if (!editMode || !objective.canApproveKeyResult) return;

                          updateLocalKeyResult(keyResult.id, {
                            approved: event.target.checked,
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
      {evidenceTarget && (
        <EvidenceDialog
          objectiveId={objectiveId}
          keyResult={evidenceTarget.keyResult}
          initialMode={evidenceTarget.mode}
          onClose={() => setEvidenceTarget(null)}
          onChange={() => dispatch(getObjectives()).unwrap()}
        />
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
                  min={latestKeyResultDueDay}
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