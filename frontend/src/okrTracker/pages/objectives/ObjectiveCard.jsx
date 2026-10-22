import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { useDispatch, useSelector } from "react-redux";
import { deleteObjective, updateObjective } from "../../features/objectives/objectiveSlice";
import { createKeyResult, updateKeyResult, deleteKeyResult } from "../../features/keyResults/keyResultSlice";
import keyResultService from "../../features/keyResults/keyResultService";
import { getAllUsers } from "../../features/users/userSlice";
import objectiveService from "../../features/objectives/objectiveService";

// Backend labels matched to UI labels
const API_TO_UI_STATUS = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  "overdue": "Overdue",
  "completed": "Completed",
};

const UI_TO_API_STATUS = {
  "On Track": "on-track",
  "At Risk": "at-risk",
  "Overdue": "overdue",
  "Completed": "completed",
};

const STATUS_COLOURS = {
  "not started": "#72cdf4",
  "in progress": "#00b085",
  "on-track": "#00b085",
  "at-risk": "#f4b400",
  overdue: "#e57373",
  completed: "#72cdf4",
};

const getStatusColour = (status) => 
  STATUS_COLOURS[status?.toLowerCase().replace(/\s+/g, "-")] || "#72cdf4";

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
    evidence: kr.evidence || [],
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

  //Temporary until Objective Status integration is completed
  const objectiveStatus = null;

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
  const [showEvidencePopup, setShowEvidencePopup] = useState(false);
  const [selectedEvidenceKR, setSelectedEvidenceKR] = useState(null);
  const [showViewEvidence, setShowViewEvidence] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceNote, setEvidenceNote] = useState("");

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
                keyResultData: buildKeyResultPayload(kr),
              })
            ).unwrap();
          }
        }
      }

      // Pull fresh data. New KRs get real _ids + not flagged as isNew
      await fetchKeyResults();
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
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${objective.progress}%` }}
            />

            <div
              className="progress-circle"
              style={{ left: `${objective.progress}%` }}
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
                        disabled={!editMode || !keyResult.canEdit}
                        onChange={(event) =>
                          updateLocalKeyResult(keyResult.id, { status: event.target.value })
                        }
                      >
                        <option value="Choose Progress">Choose Progress</option>
                        <option value="On Track">On Track</option>
                        <option value="At Risk">At Risk</option>
                        <option value="Overdue">Overdue</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>

                    {/* Evidence */}
                    <td>
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => {
                          setSelectedEvidenceKR(keyResult);
                          setShowViewEvidence(true);
                        }}
                      >
                        View
                      </button>

                      <span> | </span>

                      <button
                        type="button"
                        className="action-link"
                        onClick={() => {
                          setSelectedEvidenceKR(keyResult);
                          setShowEvidencePopup(true);
                        }}
                      >
                        Upload
                      </button>
                    </td>

                    {/* Approval */}
                    <td>
                      <input
                        type="checkbox"
                        checked={keyResult.approved}
                        disabled={!editMode || !objective.canApproveKeyResult}
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

      {/* Evidence Upload Popup */}
      {showEvidencePopup && (
        <div className="evidence-popup-overlay">
          <div className="evidence-popup">
            <h3>Upload Evidence</h3>

            <p>
              Key Result: <strong>{selectedEvidenceKR?.name}</strong>
            </p>

            <textarea
              className="evidence-note"
              placeholder="Add a note"
              value={evidenceNote}
              onChange={(event) => setEvidenceNote(event.target.value)}
            />

            <div className="evidence-upload-box">
              <input
                type="file"
                multiple
                onChange={(event) => setEvidenceFiles(Array.from(event.target.files))}
              />
            </div>

            <div className="evidence-popup-buttons">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowEvidencePopup(false)}
              >
                Cancel
              </button>

              <button type="button" className="save-button">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Evidence Popup */}
      {showViewEvidence && (
        <div className="evidence-popup-overlay">
          <div className="evidence-popup">
            <h3>View Evidence</h3>

            <p>
              Key Result: <strong>{selectedEvidenceKR?.name}</strong>
            </p>

            <div className="evidence-list">
              {selectedEvidenceKR?.evidence?.length > 0 ? (
                selectedEvidenceKR.evidence.map((evidence) => (
                  <div className="evidence-item" key={evidence.id}>
                    <div>
                      <strong>{evidence.fileName}</strong>
                      {evidence.note && <p>{evidence.note}</p>}
                    </div>

                    <div className="evidence-actions">
                      <a
                        href={evidence.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-link"
                      >
                        Open
                      </a>

                      <button type="button" className="action-link">
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p>No evidence uploaded yet.</p>
              )}
            </div>

            <div className="evidence-popup-buttons">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowViewEvidence(false)}
              >
                Close
              </button>
            </div>
          </div>
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