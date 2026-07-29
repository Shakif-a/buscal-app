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
        <h2>»» All Objectives</h2>
        <p>View all objectives</p>
        <span>»»</span>
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
        <a href="#key-results">
          Open Objective 1 key results →
        </a>

        <span>1-2 of 2</span>
      </div>
    </div>
  );
}

export default ObjectivesPage;