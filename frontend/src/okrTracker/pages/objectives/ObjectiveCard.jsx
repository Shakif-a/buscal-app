import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { 
  getKeyResultsByObjective, 
  createKeyResult, 
  updateKeyResult, 
  deleteKeyResult 
} from "../../features/keyResults/keyResultSlice"

function ObjectiveCard({ objective }) {
  const dispatch = useDispatch();
  const { keyResults, isLoading: krLoading, isError: krError, message: krMessage } = useSelector(state => state.keyResults);
  
  const [showKeyResults, setShowKeyResults] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const menuRef = useRef(null);

  // Track local edits before saving
  const [localKeyResults, setLocalKeyResults] = useState([]);

  // Load key results when expanding
  useEffect(() => {
    if (showKeyResults && objective.id) {
      dispatch(getKeyResultsByObjective(objective.id));
    }
  }, [showKeyResults, objective.id, dispatch]);

  // Sync Redux data to local state when it changes
  useEffect(() => {
    setLocalKeyResults(keyResults);
  }, [keyResults]);

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

  function addKeyResult() {
    // Create new key result with default values
    const newKeyResult = {
      id: Date.now().toString(),
      title: "",
      weight: 0,
      assigned: "Unassigned",
      assignedTo: null,
      dueDate: "",
      isNew: true, // Flag to indicate this is a new, unsaved KR
    };

    setLocalKeyResults([...localKeyResults, newKeyResult]);
    setEditMode(true);
  }

  function updateLocalKeyResult(id, field, value) {
    const updatedKeyResults = localKeyResults.map((keyResult) => {
      if (keyResult.id === id || keyResult._id === id) {
        return {
          ...keyResult,
          [field]: value,
        };
      }
      return keyResult;
    });

    setLocalKeyResults(updatedKeyResults);
  }

  function deleteLocalKeyResult(id) {
    const keyResult = localKeyResults.find(kr => kr.id === id || kr._id === id);
    
    if (keyResult.isNew) {
      // If new (unsaved), just remove from local state
      setLocalKeyResults(localKeyResults.filter(kr => kr.id !== id && kr._id !== id));
    } else {
      // If existing, dispatch delete action to backend
      dispatch(deleteKeyResult({
        objectiveId: objective.id,
        keyResultId: keyResult._id || id
      }));
    }
  }

  function handleSaveKeyResults() {
    // Separate new and existing key results
    const newKeyResults = localKeyResults.filter(kr => kr.isNew);
    const modifiedKeyResults = localKeyResults.filter(kr => !kr.isNew);

    // Create new key results
    newKeyResults.forEach(kr => {
      if (kr.title && kr.weight && kr.dueDate) {
        dispatch(createKeyResult({
          objectiveId: objective.id,
          keyResultData: {
            title: kr.title,
            weight: Number(kr.weight),
            dueDate: kr.dueDate,
            assignedTo: kr.assignedTo || null,
          }
        }));
      }
    });

    // Update modified key results (compare with original)
    modifiedKeyResults.forEach(kr => {
      const original = keyResults.find(orig => orig._id === kr._id);
      if (original && JSON.stringify(kr) !== JSON.stringify(original)) {
        dispatch(updateKeyResult({
          objectiveId: objective.id,
          keyResultId: kr._id,
          keyResultData: {
            title: kr.title,
            weight: Number(kr.weight),
            dueDate: kr.dueDate,
            assignedTo: kr.assignedTo || null,
          }
        }));
      }
    });

    setEditMode(false);
  }

  function handleEditButton() {
    setEditMode(!editMode);
  }

  function handleCancelEdits() {
    setEditMode(false);
    setLocalKeyResults(keyResults); // Revert to last saved state
  }

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
            Objective Manager: <strong>{objective.manager}</strong>
          </p>

          <p>
            Type: <strong>{objective.type}</strong>
          </p>
        </div>

        <p className="objective-due-date">
          Due: <strong>{objective.dueDate}</strong>
        </p>

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
                onClick={() => {
                  console.log("Edit Objective", objective);
                  setShowMenu(false);
                }}
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
            <div className="progress-fill" style={{ width: `${objective.progress}%` }} />

            <div className="progress-circle" style={{ left: `${objective.progress}%` }} />
          </div>
        </div>
      </div>

      {/* Key Results Table */}
      {showKeyResults && (
        <div className="key-results-section">
          {krLoading && <p>Loading key results...</p>}
          {krError && <p className="error-message">{krMessage}</p>}
          
          {!krLoading && (
            <>
              <table className="key-results-table">
                <thead>
                  <tr>
                    <th>KEY RESULTS</th>
                    <th>WEIGHT</th>
                    <th>ASSIGNED</th>
                    <th>DUE DATE</th>
                  </tr>
                </thead>

                <tbody>
                  {localKeyResults.map((keyResult) => (
                    <tr key={keyResult._id || keyResult.id}>
                      <td>
                        {editMode && (
                          <button
                            type="button"
                            className="remove-key-result"
                            onClick={() => deleteLocalKeyResult(keyResult._id || keyResult.id)}
                          >
                            −
                          </button>
                        )}

                        {editMode ? (
                          <input
                            className="key-result-input"
                            type="text"
                            value={keyResult.title}
                            placeholder="Enter key result title"
                            onChange={(event) =>
                              updateLocalKeyResult(
                                keyResult._id || keyResult.id,
                                "title",
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          <span>{keyResult.title}</span>
                        )}
                      </td>

                      <td>
                        {editMode ? (
                          <input
                            className="key-result-small-input"
                            type="number"
                            min="1"
                            max="100"
                            value={keyResult.weight}
                            placeholder="0"
                            onChange={(event) =>
                              updateLocalKeyResult(
                                keyResult._id || keyResult.id,
                                "weight",
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          `${keyResult.weight}%`
                        )}
                      </td>

                      <td>
                        {editMode ? (
                          <input
                            className="key-result-input"
                            type="text"
                            value={keyResult.assigned}
                            placeholder="Assigned to"
                            onChange={(event) =>
                              updateLocalKeyResult(
                                keyResult._id || keyResult.id,
                                "assigned",
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          keyResult.assigned
                        )}
                      </td>

                      <td>
                        {editMode ? (
                          <input
                            className="key-result-input"
                            type="text"
                            placeholder="DD/MM/YY"
                            value={keyResult.dueDate}
                            onChange={(event) =>
                              updateLocalKeyResult(
                                keyResult._id || keyResult.id,
                                "dueDate",
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          keyResult.dueDate
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="key-results-footer">
                <button
                  type="button"
                  className="add-key-result"
                  onClick={addKeyResult}
                  disabled={!editMode}
                >
                  + Add Key Result
                </button>

                <div className="footer-buttons">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={handleCancelEdits}
                    disabled={!editMode}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="save-button"
                    onClick={editMode ? handleSaveKeyResults : handleEditButton}
                  >
                    {editMode ? "Save Key Results" : "Edit Key Results"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

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
                onClick={() => {
                  console.log("Delete objective", objective);
                  setShowDeleteModal(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ObjectiveCard;