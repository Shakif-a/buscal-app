import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import keyResultService from "../../features/objectives/keyResultService";
import { getObjectives } from "../../features/objectives/objectiveSlice";
import ObjectiveActions from "./ObjectiveActions";

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : "";
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
  const keyResults = objective.keyResults || [];
  const objectiveId = objective._id || objective.id;

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
      setError(
        failure.response?.data?.message ||
          failure.message ||
          "Could not save key result",
      );
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
      setError(
        failure.response?.data?.message ||
          failure.message ||
          "Could not update approval",
      );
    } finally {
      setSaving(false);
    }
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
    </div>
  );
}

export default ObjectiveCard;
