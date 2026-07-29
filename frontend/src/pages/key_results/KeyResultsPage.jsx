import "./KeyResultsPage.css";

function KeyResultsPage() {
  return (
    <div className="key-results-page">
      {/* Search bar */}
      <div className="key-results-top-row">
        <input
          className="key-results-search"
          type="text"
          placeholder="Search"
        />
      </div>

      {/* Banner */}
      <div className="key-results-banner">
        <span className="banner-arrow">»»</span>

        <h2>Key Results</h2>

        <span className="banner-arrow">»»</span>
      </div>

      {/* Main card */}
      <div className="key-results-card">
        {/* Objective information */}
        <div className="key-results-objective-details">
          <div className="key-results-objective-info">
            <h3 className="key-results-objective-title">
              Objective 1
            </h3>

            <p>
              Group: <strong>R&D</strong>
            </p>

            <p>
              Objective Manager: <strong>John Smith</strong>
            </p>

            <p>
              Type: <strong>Committed</strong>
            </p>
          </div>

          <p className="key-results-due-date">
            Due: <strong>30/10/26</strong>
          </p>
        </div>

        {/* Divider */}
        <hr className="key-results-divider" />

        {/* Progress Section */}
        <div className="key-results-progress">
          <p className="progress-label">Overall Progress</p>

          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>

          <p className="progress-percentage">65%</p>
        </div>
      </div>
    </div>
  );
}

export default KeyResultsPage;