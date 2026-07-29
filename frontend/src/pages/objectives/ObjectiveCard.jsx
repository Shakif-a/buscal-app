function ObjectiveCard({ objective }) {
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
      </div>

      <hr />

      {/* Progress section */}
      <div className="progress-section">
        <select defaultValue="progress">
          <option value="progress">Progress</option>
        </select>

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
    </div>
  );
}

export default ObjectiveCard;