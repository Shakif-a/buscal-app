import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getObjectives, reset } from "../../features/objectives/objectiveSlice";
import "./ObjectivesPage.css";
import ObjectiveCard from "./ObjectiveCard";

function ObjectivesPage() {
  const dispatch = useDispatch();

  // Local state for UI search/filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedObjectives, setSelectedObjectives] = useState("");

  // Connect to global Redux state
  const { objectives, isLoading, isError, message } = useSelector(
    (state) => state.okr
  );

  // Fetch data on page mount
  useEffect(() => {
    dispatch(getObjectives());

    return () => {
      dispatch(reset());
    };
  }, [dispatch]);

  // Generate dynamic filter dropdowns safely
  const uniqueFilterOptions = useMemo(() => {
    // Check if objectives exist
    if (!objectives || !Array.isArray(objectives)) {
      return { groups: [], owners: [], types: [] };
    }

    const groups = new Set();
    const owners = new Set();
    const types = new Set();

    objectives.forEach((obj) => {
      if (obj.group) groups.add(obj.group);
      if (obj.manager) owners.add(obj.manager);
      if (obj.type) types.add(obj.type);
    });

    return {
      groups: Array.from(groups),
      owners: Array.from(owners),
      types: Array.from(types),
    };
  }, [objectives]);

  // Filter objectives
  const filteredObjectives = useMemo(() => {
    if (!objectives || !Array.isArray(objectives)) return [];

    return objectives.filter((obj) => {
      // Safe string checks to prevent compilation crashes on null properties
      const titleText = obj.title ? String(obj.title).toLowerCase() : "";
      const matchesSearch =
        !searchQuery ||
        titleText.includes(searchQuery.toLowerCase());

      const matchesGroup =
        !selectedGroup || obj.group === selectedGroup;

      const matchesOwner =
        !selectedOwner || obj.manager === selectedOwner;

      const matchesType =
        !selectedType || obj.type === selectedType;

      return (
        matchesSearch &&
        matchesGroup &&
        matchesOwner &&
        matchesType
      );
    });
  }, [
    objectives,
    searchQuery,
    selectedGroup,
    selectedOwner,
    selectedType,
  ]);

  // Early Return 1: Still fetching from Node server
  if (isLoading) {
    return (
      <div className="objectives-page">
        <div className="objectives-status">
          Loading data from systems database...
        </div>
      </div>
    );
  }

  // Early Return 2: Something crashed on the network
  if (isError) {
    return (
      <div className="objectives-page">
        <div className="objectives-status error-text">
          Error: {message}
        </div>
      </div>
    );
  }

  return (
    <div className="objectives-page">

      {/* Objectives heading */}
      <div className="objectives-banner">
        <img
          src="/images/okr/ArrowLogoLeft.png"
          alt="Arrow Logo L"
          className="logo"
        />

        <h2>All Objectives</h2>

        <img
          src="/images/okr/ArrowLogoRight.png"
          alt="Arrow Logo R"
          className="logo"
        />
      </div>

      {/* Dynamic Filters */}
      <div className="objective-filters">

        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          <option value="">Group (All)</option>

          {uniqueFilterOptions.groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
        >
          <option value="">Owner (All)</option>

          {uniqueFilterOptions.owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">Type (All)</option>

          {uniqueFilterOptions.types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Objectives Filter */}
        <select
          value={selectedObjectives}
          onChange={(e) => setSelectedObjectives(e.target.value)}
        >
          <option value="">Objectives (All)</option>
          <option value="mine">My Objectives</option>
        </select>

        <input
          className="objectives-search"
          type="text"
          placeholder="Search Objectives"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Clean alternative view when dataset returns completely empty */}
      {filteredObjectives.length === 0 ? (
        <div className="objectives-status">
          No matching objectives found in database.
        </div>
      ) : (
        filteredObjectives.map((objective) => (
          <ObjectiveCard
            key={objective._id || objective.id}
            objective={objective}
          />
        ))
      )}

      {/* Footer */}
      <div className="objectives-footer">
        <button className="page-button">
          ← Previous
        </button>

        <span className="page-count">
          1 of 1
        </span>

        <button className="page-button">
          Next →
        </button>
      </div>
    </div>
  );
}

export default ObjectivesPage;