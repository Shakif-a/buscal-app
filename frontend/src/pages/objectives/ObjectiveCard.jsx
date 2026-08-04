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
        <button className="progress-button">
          View Key Results
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
      <div className="key-results-section">
        <table className="key-results-table">
          <thead>
            <tr>
              <th>KEY REQUIREMENTS</th>
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
            <tr>
              <td>KR#1</td>
              <td>30%</td>
              <td>J. Smith</td>
              <td>90%</td>
              <td>30/10/26</td>

              <td>
                <select>
                  <option>Completed</option>
                </select>
              </td>

              <td>
                <a href="/">View</a> | <a href="/">Edit</a> | <a href="/">Delete</a>
              </td>

              <td>
                <input type="checkbox" defaultChecked />
              </td>
            </tr>

            <tr>
              <td>KR#2</td>
              <td>25%</td>
              <td>A. Lee</td>
              <td>40%</td>
              <td>12/11/26</td>

              <td>
                <select>
                  <option>At Risk</option>
                </select>
              </td>

              <td>
                <a href="/">View</a> | <a href="/">Edit</a> | <a href="/">Delete</a>
              </td>

              <td>
                <input type="checkbox" />
              </td>
            </tr>

            <tr>
              <td>KR#3</td>
              <td>25%</td>
              <td>R. Kaur</td>
              <td>60%</td>
              <td>20/11/26</td>

              <td>
                <select>
                  <option>On Track</option>
                </select>
              </td>

              <td>
                <a href="/">View</a> | <a href="/">Edit</a> | <a href="/">Delete</a>
              </td>

              <td>
                <input type="checkbox" />
              </td>
            </tr>

            <tr>
              <td>KR#4</td>
              <td>20%</td>
              <td>M. Chan</td>
              <td>15%</td>
              <td>30/11/26</td>

              <td>
                <select>
                  <option>Choose Progress</option>
                </select>
              </td>

              <td>
                <a href="/">View</a> | <a href="/">Edit</a> | <a href="/">Delete</a>
              </td>

              <td>
                <input type="checkbox" />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="key-results-footer">
          <button className="add-key-result">
            + Add Key Result
          </button>

          <div className="footer-buttons">
            <button className="cancel-button">
              Cancel
            </button>

            <button className="save-button">
              Edit Key Results
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ObjectiveCard;