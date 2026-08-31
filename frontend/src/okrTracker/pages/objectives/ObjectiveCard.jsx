import { useState } from "react";

function ObjectiveCard({ objective }) {
  // Key Results
  const [showKeyResults, setShowKeyResults] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Evidence
  const [showEvidencePopup, setShowEvidencePopup] = useState(false);
  const [selectedEvidenceKR, setSelectedEvidenceKR] = useState(null);
  const [showViewEvidence, setShowViewEvidence] = useState(false);

  // Key Results Data
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
            Owner: <strong>{objective.manager}</strong>
          </p>

          <p>
            Type: <strong>{objective.type}</strong>
          </p>
        </div>

        <p className="objective-due-date">
          Due: <strong>{objective.dueDate}</strong>
        </p>
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
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="key-results-footer">
            {editMode && (
              <button
                type="button"
                className="add-key-result"
                onClick={addKeyResult}
              >
                + Add Key Result
              </button>
            )}

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
            />

            <div className="evidence-upload-box">
              <input type="file" multiple />
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

            <div className="evidence-list">
              <p>No evidence uploaded yet.</p>
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

    </div>
  );
}

export default ObjectiveCard;