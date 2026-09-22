import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { useDispatch } from "react-redux";
import { deleteObjective, updateObjective, } from "../../features/objectives/objectiveSlice";

function ObjectiveCard({ objective }) {
  // Key Results
  const [showKeyResults, setShowKeyResults] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const[editTitle, setEditTitle] = useState("");
  const[editDueDate, setEditDueDate] = useState("");
  const[editOwner, setEditOwner] = useState("");
  const[editGroup, setEditGroup] = useState("");
  const[editCommitmentType, setEditCommitmentType] = useState("");
  const[editDescription, setEditDescription] = useState("");

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const menuRef = useRef(null);

  const dispatch = useDispatch();

  useEffect(() => {
    function handleClickOutside(event){
      if (menuRef.current && !menuRef.current.contains(event.target)){
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function openEditModal() {
    setEditTitle(objective.title || "");
    setEditOwner(objective.owner?._id || objective.owner || "");
    setEditGroup(objective.group || "");
    setEditCommitmentType (objective.commitmentType || "committed");
    setEditDescription (objective.description || "");

    if (objective.dueDate) {
      const date = new Date(objective.dueDate);
      const formattedDate = date.toISOString().split("T")[0];
      setEditDueDate(formattedDate);
    } else {
      setEditDueDate("");
    }

    setShowMenu(false);
    setShowEditModal(true);
  }
  

  // Evidence
  const [showEvidencePopup, setShowEvidencePopup] = useState(false);
  const [selectedEvidenceKR, setSelectedEvidenceKR] = useState(null);
  const [showViewEvidence, setShowViewEvidence] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceNote, setEvidenceNote] = useState("");

  // Key Results Data
  const [keyResults, setKeyResults] = useState([]);
  const [originalKeyResults, setOriginalKeyResults] = useState([]);

  function addKeyResult() {
    const newKeyResult = {
      id: Date.now(),
      name: "",
      weight: 0,
      assigned: "",
      progress: 0,
      dueDate: "",
      status: "Choose Progress",
      approved: false,
    };

    setKeyResults([...keyResults, newKeyResult]);
    setEditMode(true);
  }

  function updateKeyResult(id, field, value) {
    const updatedKeyResults = keyResults.map((keyResult) => {
      if (keyResult.id === id) {
        return {
          ...keyResult,
          [field]: value,
        };
      }

      return keyResult;
    });

    setKeyResults(updatedKeyResults);
  }

  function deleteKeyResult(id) {
    const updatedKeyResults = keyResults.filter(
      (keyResult) => keyResult.id !== id
    );

    setKeyResults(updatedKeyResults);
  }

  function handleEditButton() {
    if (!editMode){
      //Entering edit mode
      setOriginalKeyResults(
        keyResults.map((keyResult) => ({...keyResult}))
      );

      setEditMode(true);
    } else {
      //Save Changes
      setEditMode(false);
      setOriginalKeyResults([]);
    }
  }

  const totalKeyResultWeight = keyResults.reduce(
    (total, keyResult) => total + Number(keyResult.weight),
    0
  );

  {/*delete objective*/}
  const handleDeleteObjective = async () => {
    try {
      const objectiveId = objective._id || objective.id;

      await dispatch(deleteObjective(objectiveId)).unwrap();

      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete objective", error);
    }
  };

  const handleUpdateObjective = async () => {
    try {
      const objectiveId = objective._id || objective.id;

      const objectiveData = {
        title: editTitle,
        dueDate: editDueDate,
        owner: editOwner,
        group: editGroup,
        commitmentType: editCommitmentType,
        description: editDescription,
      };

      await dispatch(
        updateObjective({
          objectiveId,
          objectiveData,
        })
      ).unwrap();

      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update objective", error);
    }
  };

  // KR Save Validity Check
  const keyResultsValid =
    keyResults.length === 0 ||
    (
      keyResults.every((keyResult) =>
      keyResult.name.trim() !== "" &&
      Number(keyResult.weight) > 0 &&
      keyResult.assigned !== "" &&
      keyResult.dueDate !== ""
    ) &&
    totalKeyResultWeight === 100
    );

  //Weight Popup
  const [showWeightPopup, setShowWeightPopup] = useState(false);
  const [weightDrafts, setWeightDrafts] = useState([]);

  const openWeightPopup = () => {
    setWeightDrafts(
      keyResults.map((keyResult) => ({
        id: keyResult.id,
        weight: keyResult.weight,
      }))
    );
    setShowWeightPopup(true);
  };

  {/*Weighting Popup*/ }
  const handleWeightChange = (id, newWeight) => {
    const weight = Math.max(0, Math.min(100, Number(newWeight)));

    setWeightDrafts((previousWeights) =>
      previousWeights.map((item) =>
        item.id === id
          ? { ...item, weight: weight }
          : item
      )
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

    setKeyResults((previousKeyResults) =>
      previousKeyResults.map((keyResult) => {
        const draft = weightDrafts.find(
          (item) => item.id === keyResult.id
        );

        return draft
          ? { ...keyResult, weight: draft.weight }
          : keyResult
      })
    );
    setShowWeightPopup(false);
    setWeightDrafts([])
  };

  return (
    <div className="objective-card">
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
        </div>

        <p className="objective-due-date">
          Due: <strong>
            {objective.dueDate 
              ? new Date(objective.dueDate).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })
              : "No due date"}
          </strong>
        </p>

        <div className="objective-menu-container"
        ref={menuRef}>
          <button type="button"
          className="objective-menu-button"
          onClick={() => setShowMenu(!showMenu)}>...</button>
          {showMenu && (
            <div className="objective-menu-dropdown">
              <button type="button"
              className="objective-menu-item"
              onClick={openEditModal}
              >Edit</button>
              <button type="button"
              className="objective-menu-item delete-menu-item"
              onClick={() => {setShowMenu(false);
                setShowDeleteModal(true);
              }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
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
                  <tr key={keyResult.id}>

                    {/* Key Result name */}
                    <td>
                      {editMode && (
                        <button
                          type="button"
                          className="remove-key-result"
                          onClick={() => deleteKeyResult(keyResult.id)}
                        >
                          −
                        </button>
                      )}

                      {editMode ? (
                        <input
                          className="key-result-name-input"
                          type="text"
                          placeholder="Enter Key Result"
                          value={keyResult.name}
                          onChange={(event) =>
                            updateKeyResult(
                              keyResult.id,
                              "name",
                              event.target.value
                            )
                          }
                        />
                      ) : (
                        <span>{keyResult.name}</span>
                      )}
                    </td>

                    {/* Weight */}
                    <td>
                      {editMode ? (
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

                    {/* Assigned */}
                    <td>
                      {editMode ? (
                        <select
                          value={keyResult.assigned}
                          onChange={(event) =>
                            updateKeyResult(
                              keyResult.id,
                              "assigned",
                              event.target.value
                            )
                          }
                        >
                          <option value="">Assign Employee</option>
                          <option value="Employee 1">Employee 1</option>
                          <option value="Employee 2">Employee 2</option>
                          <option value="Employee 3">Employee 3</option>
                          <option value="Employee 4">Employee 4</option>
                          <option value="Employee 5">Employee 5</option>
                        </select>
                      ) : (
                        keyResult.assigned
                      )}
                    </td>

                    {/* Due Date */}
                    <td>
                      {editMode ? (
                        <input
                          className="date-input"
                          type="date"
                          value={keyResult.dueDate}
                          onChange={(event) =>
                            updateKeyResult(
                              keyResult.id,
                              "dueDate",
                              event.target.value
                            )
                          }
                        />
                      ) : (
                        keyResult.dueDate
                      )}
                    </td>

                    {/* Progress */}
                    <td>
                      {editMode ? (
                        <input
                          className="key-result-small-input"
                          type="number"
                          min="0"
                          max="100"
                          value={keyResult.progress}
                          onChange={(event) =>
                            updateKeyResult(
                              keyResult.id,
                              "progress",
                              event.target.value
                            )
                          }
                        />
                      ) : (
                        `${keyResult.progress}%`
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <select
                        className={`status-select ${keyResult.status.toLowerCase().replace(" ", "-")}`}
                        value={keyResult.status}
                        disabled={!editMode}
                        onChange={(event) =>
                          updateKeyResult(
                            keyResult.id,
                            "status",
                            event.target.value
                          )
                        }
                      >
                        <option value="Choose Progress">
                          Choose Progress
                        </option>

                        <option value="On Track">
                          On Track
                        </option>

                        <option value="At Risk">
                          At Risk
                        </option>

                        <option value="Overdue">
                          Overdue
                        </option>

                        <option value="Completed">
                          Completed
                        </option>
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
                        onChange={(event) => {
                          if (!editMode) return;

                          updateKeyResult(
                            keyResult.id,
                            "approved",
                            event.target.checked
                          );
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
              {editMode && (
                <button
                  type="button"
                  className="add-key-result"
                  onClick={addKeyResult}
                >
                  + Add Key Result
                </button>
              )}

              {editMode && keyResults.length > 0 && (
                <>
                  {!keyResults.every((keyResult) =>
                  keyResult.name.trim() !== "" &&
                  Number(keyResult.weight) > 0 &&
                  keyResult.assigned !== "" &&
                  keyResult.dueDate !== ""
                  ) && (
                    <p className="key-result-validation">
                    Key Results Title, Weight, Assigned Employee and Due Date are required fields.
                    </p>
                  )}
                  
                  {totalKeyResultWeight !== 100 &&(
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

              <button
                type="button"
                className="save-button"
                onClick={handleEditButton}
                disabled={editMode && !keyResultsValid}
              >
                {editMode ? "Save Key Results" : "Edit Key Results"}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Weight - Popup*/}
      {showWeightPopup && (
        <div className="weight-popup-overlay">
          <div className="weight-popup">
            {/*Weight Popup Header*/}
            <div className="weight-popup-header">
              <h3>Edit Key Result Weights</h3>

              <button
                type="button"
                className="weight-popup-close"
                onClick={closeWeightPopup}
              >
                x
              </button>

              <p className="weight-popup-objective">Objective:
                <strong> {objective.title}</strong>
              </p>

              <p className="weight-popup-description">
                Combined Weighting Must Equal 100%
              </p>

            </div>

            {/*Weight Popup Content*/}
            <div className="weight-popup-content">
              {/*Sliders here */}
              {keyResults.map((keyResult) => {
                const draft = weightDrafts.find(
                  (item) => item.id === keyResult.id
                );

                const currentWeight = draft?.weight ?? keyResult.weight;

                return (
                  <div className="weight-slider-item"
                    key={keyResult.id}
                  >
                    {/*KR Title & Employee Name*/}
                    <div className="weight-slider-info">
                      <span className="weight-slider-title">{keyResult.name}</span>

                      <span className="weight-slider-employee">- {keyResult.assigned}</span>

                      {/*<span className="weight-slider-percentage">{keyResult.weight}%</span>*/}
                    </div>

                    <div className="weight-slider-controls">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={currentWeight}
                        onChange={(e) =>
                          handleWeightChange(
                            keyResult.id,
                            e.target.value
                          )
                        }
                        className="weight-slider"
                      />

                      <div className="weight-slider-percentage">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={currentWeight}
                          onChange={(e) =>
                            handleWeightChange(
                              keyResult.id,
                              e.target.value
                            )
                          }
                        />

                        <span>%</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Total Weight */}
            <div className="weight-total">
              <span>Total Weight</span>
              <strong className={
                totalWeight === 100
                  ? "weight-total-valid"
                  : "weight-total-invalid"
              }
              >
                {totalWeight}%
              </strong>
            </div>

            {/*Weight Popup buttons*/}
            <div className="weight-popup-buttons">
              <button
                type="button"
                className="cancel-button"
                onClick={closeWeightPopup}
              >
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
                onChange={(event) =>
                  setEvidenceFiles(Array.from(event.target.files))
                }
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

              <button
                type="button"
                className="save-button"
              >
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

            {/* Evidence List */}
            <div className="evidence-list">
              {selectedEvidenceKR?.evidence?.length > 0 ? (
                selectedEvidenceKR.evidence.map((evidence) => (
                  <div className="evidence-item" key={evidence.id}>
                    <div>
                      <strong>{evidence.fileName}</strong>

                      {evidence.note && (
                        <p>{evidence.note}</p>
                      )}
                    </div>

                    {/* Evidence Actions */}
                    <div className="evidence-actions">
                      <a
                        href={evidence.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-link"
                      >
                        Open
                      </a>

                      <button
                        type="button"
                        className="action-link"
                      >
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

      {showDeleteModal && (
        <div className="popup-overlay">
          <div className="delete-objective-popup">
            <h2>Delete Objective</h2>
            <p>Are you sure you want to delete <strong>{objective.title}</strong>?</p>
            <p>This action cannot be undone.</p>

            <div className="popup-buttons">
              <button type="button"
              className="popup-cancel-button"
              onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button type="button"
              className="popup-delete-button"
              onClick={handleDeleteObjective}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="edit-popup-overlay">
          <div className="edit-objective-popup">
            <div className="edit-popup-header">
              <h2>Edit Objective</h2>

              <button type="button"
              className="edit-popup-close"
              onClick={() => setShowEditModal(false)}>x</button>
            </div>

            <div className="edit-objective-form">
              <div className="edit-form-left">
                <label>Title</label>
                <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter Objective Title"/>

                <label>Due Date</label>
                <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    />
                
                <label>Owner</label>
                <input
                    type="text"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    />
                
                <label>Group</label>
                <input
                    type="text"
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    />
                
                <label>Type</label>
                <select
                    value={editCommitmentType}
                    onChange={(e) => setEditCommitmentType(e.target.value)}
                >
                  <option value = "committed">Committed</option>
                  <option value = "aspirational">Aspirational</option>
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