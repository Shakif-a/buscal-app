import React, { useEffect, useState } from "react";
import adminService from "../../features/admin/adminService";
import "./GroupManagement.css";

function getErrorMessage(error) {
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }

  return "Something went wrong";
}

function getUserName(user) {
  if (!user) {
    return "Not assigned";
  }

  return `${user.firstName || ""} ${user.lastName || ""}`.trim();
}

function GroupManagement() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [draftMembers, setDraftMembers] = useState([]);
  const [draftManager, setDraftManager] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const groupList = await adminService.getGroups();
      const userList = await adminService.getUsers();

      setGroups(groupList);
      setUsers(userList);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  function openEditor(group) {
    if (expandedGroup === group._id) {
      cancelEdit();
      return;
    }

    const memberIds = [];

    for (let i = 0; i < group.members.length; i++) {
      memberIds.push(group.members[i]._id);
    }

    setDraftMembers(memberIds);
    setDraftManager(group.manager ? group.manager._id : "");
    setExpandedGroup(group._id);
    setMessage("");
    setError("");
  }

  function toggleMember(userId) {
    if (draftMembers.includes(userId)) {
      setDraftMembers(draftMembers.filter((id) => id !== userId));
    } else {
      setDraftMembers([...draftMembers, userId]);
    }
  }

  function cancelEdit() {
    setExpandedGroup(null);
    setDraftMembers([]);
    setDraftManager("");
  }

  async function saveChanges(groupId) {
    try {
      setError("");

      const savedGroup = await adminService.updateGroup(groupId, {
        manager: draftManager || null,
        members: draftMembers,
      });

      setGroups(
        groups.map((group) => {
          if (group._id === groupId) {
            return savedGroup;
          }

          return group;
        })
      );

      setMessage("Group changes saved");
      cancelEdit();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function addGroup() {
    const name = window.prompt("Enter a name for the new group:");

    if (!name || !name.trim()) {
      return;
    }

    try {
      setError("");
      const group = await adminService.createGroup(name.trim());
      setGroups([...groups, group]);
      setMessage("Group created");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const visibleGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="group-management">
      <div className="group-header">
        <div className="group-header-title">
          <img
            src="/images/okr/ArrowLogoLeft.png"
            alt="Arrow Logo L"
            className="logo"
          />
          <h1>Group Management</h1>
        </div>
        <img
          src="/images/okr/ArrowLogoRight.png"
          alt="Arrow Logo R"
          className="logo"
        />
      </div>

      <div className="group-search-row">
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search group..."
          className="group-search-input"
        />
      </div>

      <div className="group-content-box">
        <div className="group-add-section">
          <button onClick={addGroup} className="group-add-button">
            (+) Add Group
          </button>
        </div>

        {message && <div className="group-message">{message}</div>}
        {error && <div className="group-error">{error}</div>}

        <div className="group-table-header">
          <div>GROUP NAME</div>
          <div>MANAGER</div>
          <div>MEMBERS</div>
          <div>ACTIONS</div>
        </div>

        {loading && <div className="group-message">Loading groups...</div>}

        {!loading && visibleGroups.length === 0 && (
          <div className="group-message">No groups found</div>
        )}

        {visibleGroups.map((group) => (
          <div key={group._id}>
            <div className="group-table-row">
              <div className="group-name">{group.name}</div>
              <div className="group-manager-name">
                {getUserName(group.manager)}
              </div>
              <div className="group-member-count">{group.members.length}</div>
              <div>
                <button
                  onClick={() => openEditor(group)}
                  className="group-edit-button"
                >
                  Edit
                  <span className="group-edit-arrow">
                    {expandedGroup === group._id ? "▴" : "▾"}
                  </span>
                </button>
              </div>
            </div>

            {expandedGroup === group._id && (
              <div className="group-member-panel">
                <label className="group-manager-label">
                  Group manager
                  <select
                    value={draftManager}
                    onChange={(event) => setDraftManager(event.target.value)}
                    className="group-manager-select"
                  >
                    <option value="">Not assigned</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {getUserName(user)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="group-member-title">Members</div>

                <div className="group-member-grid">
                  {users.map((user) => (
                    <label key={user._id} className="group-member-label">
                      <input
                        type="checkbox"
                        checked={draftMembers.includes(user._id)}
                        onChange={() => toggleMember(user._id)}
                        className="group-member-checkbox"
                      />
                      <span className="group-member-name">
                        {getUserName(user)}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="group-action-buttons">
                  <button onClick={cancelEdit} className="group-cancel-button">
                    Cancel
                  </button>
                  <button
                    onClick={() => saveChanges(group._id)}
                    className="group-save-button"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default GroupManagement;
