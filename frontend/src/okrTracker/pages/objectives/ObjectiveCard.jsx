import { useEffect, useRef, useState } from "react";

function ObjectiveCard({ objective }) {
  const [showKeyResults, setShowKeyResults] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const menuRef = useRef(null);

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

  const [keyResults, setKeyResults] = useState([
    {
      id: 1,
      name: "KR#1",
      weight: 30,
      assigned: "J. Smith",
      progress: 90,
      dueDate: "30/10/26",
      status: "Completed",
      approved: true,
    },
    {
      id: 2,
      name: "KR#2",
      weight: 25,
      assigned: "A. Lee",
      progress: 40,
      dueDate: "12/11/26",
      status: "At Risk",
      approved: false,
    },
    {
      id: 3,
      name: "KR#3",
      weight: 25,
      assigned: "R. Kaur",
      progress: 60,
      dueDate: "20/11/26",
      status: "On Track",
      approved: false,
    },
    {
      id: 4,
      name: "KR#4",
      weight: 20,
      assigned: "M. Chan",
      progress: 15,
      dueDate: "30/11/26",
      status: "Choose Progress",
      approved: false,
    },
  ]);

  function addKeyResult() {
    const newKeyResult = {
      id: Date.now(),
      name: `KR#${keyResults.length + 1}`,
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
    setEditMode(!editMode);
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

        <div className="objective-menu-container"
        ref={menuRef}>
          <button type="button"
          className="objective-menu-button"
          onClick={() => setShowMenu(!showMenu)}>...</button>
          {showMenu && (
            <div className="objective-menu-dropdown">
              <button type="button"
              className="objective-menu-item"
              onClick={() => {console.log("Edit Objective", objective);
                              setShowMenu(false);
              }}>Edit</button>
              <button type="button"
              className="objective-menu-item delete-menu-item"
              onClick={() => {setShowMenu(false);
                setShowDeleteModal(true);
              }}>Delete</button>
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
                <th>KEY RESULTS</th>
                <th>WEIGHT</th>
                <th>ASSIGNED</th>
                <th>PROGRESS</th>
                <th>DUE DATE</th>
                <th>STATUS</th>
                <th>EVIDENCE</th>
                <th>APPROVAL</th>
              </tr>
            </thead>

            <tbody>
              {keyResults.map((keyResult) => (
                <tr key={keyResult.id}>
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

                    <span>{keyResult.name}</span>
                  </td>

                  <td>
                    {editMode ? (
                      <input
                        className="key-result-small-input"
                        type="number"
                        value={keyResult.weight}
                        onChange={(event) =>
                          updateKeyResult(
                            keyResult.id,
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
                        onChange={(event) =>
                          updateKeyResult(
                            keyResult.id,
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

                  <td>
                    {editMode ? (
                      <input
                        className="key-result-input"
                        type="text"
                        placeholder="DD/MM/YY"
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

                  <td>
                    <select
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
                      <option value="Not Started">Not Started</option>
                      <option value="On Track">On Track</option>
                      <option value="At Risk">At Risk</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>

                  <td>
                    <button type="button" className="action-link">
                      View
                    </button>

                    <span> | </span>

                    <button type="button" className="action-link">
                      Edit
                    </button>

                    <span> | </span>

                    <button type="button" className="action-link">
                      Delete
                    </button>
                  </td>

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
              ))}
            </tbody>
          </table>

          <div className="key-results-footer">
            <button
              type="button"
              className="add-key-result"
              onClick={addKeyResult}
            >
              + Add Key Result
            </button>

            <div className="footer-buttons">
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setEditMode(false);
                  setShowKeyResults(false);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={handleEditButton}
              >
                {editMode ? "Save Key Results" : "Edit Key Results"}
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
              onClick={() => {console.log("Delete objective", objective);
                              setShowDeleteModal(false);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ObjectiveCard;