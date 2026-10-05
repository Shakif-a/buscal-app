import React, { useState } from "react";
import "./GroupManagement.css";


function GroupManagement() {
  // add user 
  const allPeople = [
    "Sarah Nguyen",
    "Liam Brooks",
    "Emma Wills",
    "Noah Reed",
    "Olivia Tan",
  ];

  // The list of groups
  const [groups, setGroups] = useState([
    { name: "Sales", members: ["Sarah Nguyen", "Emma Wills"] },
    { name: "Tech", members: ["Liam Brooks", "Noah Reed", "Olivia Tan"] },
    { name: "Marketing", members: ["Sarah Nguyen", "Liam Brooks", "Emma Wills", "Noah Reed", "Olivia Tan"] },
  ]);

  // add a new user through the Add Users button.
  const [people, setPeople] = useState(allPeople);

  // Which group is currently expanded for editing. null means none.
  const [expandedGroup, setExpandedGroup] = useState(null);

  // A temporary copy of the members being edited. 
  const [draftMembers, setDraftMembers] = useState([]);

  // The text typed into the group search box.
  const [searchText, setSearchText] = useState("");

  // Open the editor for a group. We copy its members into the draft.
  function openEditor(groupName) {
    // If this group is already open, close it.
    if (expandedGroup === groupName) {
      setExpandedGroup(null);
      return;
    }
    const group = groups.find((g) => g.name === groupName);
    setDraftMembers([...group.members]);
    setExpandedGroup(groupName);
  }

  // Tick or untick a person in the draft member list.
  function toggleMember(personName) {
    if (draftMembers.includes(personName)) {
      // Remove them.
      setDraftMembers(draftMembers.filter((name) => name !== personName));
    } else {
      // Add them.
      setDraftMembers([...draftMembers, personName]);
    }
  }

  // Save the draft members back to the real group and close the editor.
  function saveChanges(groupName) {
    setGroups((previous) =>
      previous.map((group) => {
        if (group.name === groupName) {
          return { ...group, members: [...draftMembers] };
        }
        return group;
      })
    );
    setExpandedGroup(null);
  }

  // Throw away the draft edits and close the editor.
  function cancelEdit() {
    setDraftMembers([]);
    setExpandedGroup(null);
  }

  // Add a brand new group. 
  function addGroup() {
    const name = window.prompt("Enter a name for the new group:");
    if (name && name.trim() !== "") {
      setGroups([...groups, { name: name.trim(), members: [] }]);
    }
  }

  // Add a new user to the pool and tick them into the current
  function addUser() {
    const name = window.prompt("Enter the new user's name:");
    if (name && name.trim() !== "") {
      const cleanName = name.trim();
      // Only add to the master list if they are not already there.
      if (!people.includes(cleanName)) {
        setPeople([...people, cleanName]);
      }
      // Tick them into the group being edited.
      if (!draftMembers.includes(cleanName)) {
        setDraftMembers([...draftMembers, cleanName]);
      }
    }
  }

  // Filter the groups by the search text.
  const visibleGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className= "group-management">
      {/* header */}
      <div className="group-header">
          <div className= "group-header-title">
            <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"/>
            <h1>Group Management</h1>
          </div>
          <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
        </div>

      {/* Main content */}
      <div>
        {/* Search group input */}
        <div className= "group-search-row">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="  Search group..."
              className="group-search-input"
            />
          </div>
          <div className="group-content-box">  
          {/* Add Group button */}
          <div className="group-add-section">
            <button
              onClick={addGroup}
              className="group-add-button"
          >    
              (+)Add Group
            </button>
          </div>


          {/* Table header row */}
          <div className="group-table-header">
            <div>GROUP NAME</div>
            <div>MEMBERS</div>
            <div>ACTIONS</div>
          </div>

          {/* Group rows */}
          {visibleGroups.map((group) => (
            <div key={group.name}>
              <div className="group-table-row">
                <div className="group-name">
                  {/* Show a minus icon on the expanded group */}
                  {expandedGroup === group.name && (
                    <span
                      onClick={() => openEditor(group.name)}
                      className="group-collapse-icon"
                    >
                      ⊖
                    </span>
                  )}
                  {group.name}
                </div>
                <div className="group-member-count">{group.members.length}</div>
                <div>
                  <button
                    onClick={() => openEditor(group.name)}
                    className="group-edit-button"
                  >
                    Edit
                    <span className="group-edit-arrow">
                      {expandedGroup === group.name ? "▴" : "▾"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Expanded member panel, only shown for the open group */}
              {expandedGroup === group.name && (
                <div className="group-member-panel">
                  <div className="group-member-title">
                    Members
                  </div>

                  {/* Every person in the pool, in two columns.
                      A ticked box means they belong to this group. */}
                  <div className="group-member-grid">
                    {people.map((person) => {
                      const isChecked = draftMembers.includes(person);
                      return (
                        <label
                          key={person}
                          className="group-member-label"
                        >
                          <span
                            onClick={() => toggleMember(person)}
                            className={`group-member-checkbox ${isChecked ? "checked" : ""}`}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className="group-member-name">{person}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Add Users link and the action buttons */}
                  <div className="group-action-row">
                    <button
                      onClick={addUser}
                      className="group-add-user-button"
                    >
                      (+) Add Users
                    </button>

                    <div className="group-action-buttons">
                      <button
                        onClick={cancelEdit}
                        className="group-cancel-button"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveChanges(group.name)}
                        className="group-save-button"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GroupManagement;
