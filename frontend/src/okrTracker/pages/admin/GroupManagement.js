import React, { useState } from "react";
import "./GroupManagement.css";


function GroupManagement() {
  // The dark navy colour used for headings and text.
  const navy = "#1a2b4a";

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

      {/* Main content*/}
      <div>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "16px",
            padding: "30px",
          }}
        >
          {/* Search group input and Add Group button */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="🔍  Search group..."
              style={{
                width: "45%",
                padding: "14px 18px",
                borderRadius: "10px",
                border: "1px solid #ddd",
                outline: "none",
              }}
            />
            <button
              onClick={addGroup}
              style={{
                color: "#2e6da4",
                fontWeight: "bold",
                fontSize: "18px",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              (+) Add Group
            </button>
          </div>

          {/* Table header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              padding: "0 10px 12px",
              borderBottom: "1px solid #eee",
              color: "#888",
              fontWeight: "600",
              letterSpacing: "1px",
              fontSize: "14px",
            }}
          >
            <div>GROUP NAME</div>
            <div>MEMBERS</div>
            <div>ACTIONS</div>
          </div>

          {/* Group rows */}
          {visibleGroups.map((group) => (
            <div key={group.name}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr",
                  alignItems: "center",
                  padding: "22px 10px",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div
                  style={{
                    color: navy,
                    fontSize: "18px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  {/* Show a minus icon on the expanded group */}
                  {expandedGroup === group.name && (
                    <span
                      onClick={() => openEditor(group.name)}
                      style={{ cursor: "pointer", color: "#888" }}
                    >
                      ⊖
                    </span>
                  )}
                  {group.name}
                </div>
                <div style={{ color: navy, fontSize: "18px" }}>{group.members.length}</div>
                <div>
                  <button
                    onClick={() => openEditor(group.name)}
                    style={{
                      padding: "10px 30px 10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                      backgroundColor: "#fff",
                      color: navy,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    Edit
                    <span style={{ position: "absolute", right: "10px", color: "#aaa" }}>
                      {expandedGroup === group.name ? "▴" : "▾"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Expanded member panel, only shown for the open group */}
              {expandedGroup === group.name && (
                <div
                  style={{
                    border: "1px solid #eee",
                    borderRadius: "12px",
                    padding: "24px 30px",
                    margin: "16px 0",
                  }}
                >
                  <div
                    style={{
                      color: navy,
                      fontSize: "18px",
                      fontWeight: "bold",
                      marginBottom: "20px",
                    }}
                  >
                    Members
                  </div>

                  {/* Every person in the pool, in two columns.
                      A ticked box means they belong to this group. */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      rowGap: "20px",
                      marginBottom: "40px",
                    }}
                  >
                    {people.map((person) => {
                      const isChecked = draftMembers.includes(person);
                      return (
                        <label
                          key={person}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            onClick={() => toggleMember(person)}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "6px",
                              border: isChecked ? "none" : "2px solid #ccc",
                              backgroundColor: isChecked ? "#4caf7d" : "#fff",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                            }}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span style={{ color: navy, fontSize: "17px" }}>{person}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Add Users link and the action buttons */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={addUser}
                      style={{
                        color: "#2e6da4",
                        fontWeight: "bold",
                        fontSize: "17px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      (+) Add Users
                    </button>

                    <div style={{ display: "flex", gap: "16px" }}>
                      <button
                        onClick={cancelEdit}
                        style={{
                          padding: "12px 28px",
                          borderRadius: "8px",
                          border: "1px solid #ddd",
                          backgroundColor: "#fff",
                          color: navy,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveChanges(group.name)}
                        style={{
                          padding: "12px 28px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: "#7fbce0",
                          color: "#fff",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
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
