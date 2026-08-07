import "./ObjectivesPage.css";
import ObjectiveCard from "./ObjectiveCard";

function ObjectivesPage() {
  const objectives = [
    {
      id: 1,
      title: "Objective 1",
      group: "R&D",
      manager: "John Smith",
      type: "Committed",
      dueDate: "30/10/26",
      progress: 75,
    },
    {
      id: 2,
      title: "Objective 2",
      group: "R&D",
      manager: "John Smith",
      type: "Aspirational",
      dueDate: "15/11/26",
      progress: 50,
    },
  ];

  return (
    <div className="objectives-page">
      {/* Search bar */}
      <div className="objectives-top-row">
        <input
          className="objectives-search"
          type="text"
          placeholder="Search"
        />
      </div>

      {/* Objectives heading */}
      <div className="objectives-banner">
        {/*<span className="banner-arrow">»»</span>*/}
        <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"/>

        <h2>All Objectives</h2>

        {/*<span className="banner-arrow">»»</span>*/}
        <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
      </div>

      {/* Filters */}
      <div className="objective-filters">
        <select defaultValue="">
          <option value="">Group</option>
        </select>

        <select defaultValue="">
          <option value="">Owner</option>
        </select>

        <select defaultValue="">
          <option value="">Type</option>
        </select>
      </div>

      {/* Display each objective */}
      {objectives.map((objective) => (
        <ObjectiveCard
          key={objective.id}
          objective={objective}
        />
      ))}

      {/* Footer */}
      <div className="objectives-footer">
        <button className="page-button">
          ← Previous
        </button>

        <span className="page-count">
          1 of 2
        </span>

        <button className="page-button">
          Next →
        </button>
      </div>
    </div>
  );
}

export default ObjectivesPage;