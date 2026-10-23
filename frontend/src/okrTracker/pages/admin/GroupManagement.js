import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import adminService from "../../features/admin/adminService";
import "./GroupManagement.css";

function canManageAdmin(user) {
  if (!user) {
    return false;
  }

  if (user.roles && user.roles.includes("admin")) {
    return true;
  }

  return user.exec === "yes";
}

function getUserName(user) {
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.email;
}

function getErrorMessage(error) {
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }

  return error.message || "Something went wrong";
}

function GroupManagement() {
  const { user } = useSelector((state) => state.auth);
  const [groups, setGroups] = useState([]);
  const [people, setPeople] = useState([]);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [draftMembers, setDraftMembers] = useState([]);
  const [draftManager, setDraftManager] = useState("");
  const [draftName, setDraftName] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [openGroupMenu, setOpenGroupMenu] = useState(null);
  const [groupModalAction, setGroupModalAction] = useState("");
  const [groupModalGroup, setGroupModalGroup] = useState(null);
  const [groupModalName, setGroupModalName] = useState("");

  const allowed = canManageAdmin(user);

  useEffect(() => {
    async function loadPage() {
      if (!allowed) {
        setIsLoading(false);
        return;
      }

      try {
        const users = await adminService.getUsers(user.token);
        const savedGroups = await adminService.getGroups(user.token);
        setPeople(users);
        setGroups(savedGroups);
        setHasLoaded(true);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    loadPage();
  }, [allowed, user]);

  function openEditor(group) {
    if (isSaving) {
      return;
    }

    if (expandedGroup === group._id) {
      cancelEdit();
      return;
    }

    const memberIds = [];

    for (let i = 0; i < group.members.length; i++) {
      memberIds.push(group.members[i]._id || group.members[i]);
    }

    setDraftMembers(memberIds);
    setDraftName(group.name);
    setDraftManager(group.manager ? group.manager._id || group.manager : "");
    setExpandedGroup(group._id);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function toggleMember(userId) {
    if (draftMembers.includes(userId)) {
      setDraftMembers(draftMembers.filter((id) => id !== userId));
    } else {
      setDraftMembers([...draftMembers, userId]);
    }
  }

  async function saveChanges(groupId) {
    if (!hasLoaded || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedGroup = await adminService.updateGroup(
        groupId,
        {
          name: draftName,
          manager: draftManager || null,
          members: draftMembers,
        },
        user.token,
      );

      setGroups((previous) =>
        previous.map((group) => (group._id === groupId ? updatedGroup : group)),
      );
      setExpandedGroup(null);
      setSuccessMessage("Group changes saved.");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSuccessMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEdit() {
    setDraftMembers([]);
    setDraftManager("");
    setExpandedGroup(null);
  }

  function openGroupModal(action, group) {
    if (isSaving) return;

    setGroupModalAction(action);
    setGroupModalGroup(group);
    setGroupModalName(action === "rename" ? group.name : "");
    setOpenGroupMenu(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeGroupModal() {
    if (isSaving) return;

    setGroupModalAction("");
    setGroupModalGroup(null);
    setGroupModalName("");
  }

  async function changeGroup() {
    if (isSaving) return;

    if (
      (groupModalAction === "rename" ||
        groupModalAction === "delete") &&
      !groupModalGroup
    ) {
      return;
    }

    const group = groupModalGroup;
    const action = groupModalAction;
    const name = groupModalName.trim();

    if (
      (action === "create" || action === "rename") &&
      !name
    ) {
      return;
    }

    setIsSaving(true);

    try {
      if (action === "create") {
        const newGroup = await adminService.createGroup(name, user.token);

        setGroups((previous) => [...previous, newGroup]);
      }
      if (action === "rename") {
        const memberIds = group.members.map(
          (member) => member._id || member
        );

        const managerId = group.manager
          ? group.manager._id || group.manager
          : null;

        const updatedGroup = await adminService.updateGroup(
          group._id,
          {
            name,
            manager: managerId,
            members: memberIds,
          },
          user.token
        );

        setGroups((previous) =>
          previous.map((item) =>
            item._id === group._id ? updatedGroup : item
          )
        );

        setSuccessMessage("Group renamed.");
      }

      if (action === "delete") {
        await adminService.deleteGroup(group._id, user.token);

        setGroups((previous) =>
          previous.filter((item) => item._id !== group._id)
        );

        if (expandedGroup === group._id) {
          setExpandedGroup(null);
        }

        setSuccessMessage("Group deleted.");
      }

      setErrorMessage("");

      setGroupModalAction("");
      setGroupModalGroup(null);
      setGroupModalName("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSuccessMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  function addGroup() {
    if (!hasLoaded || isSaving) {
      return;
    }

    setGroupModalAction("create");
    setGroupModalGroup(null);
    setGroupModalName("");
    setOpenGroupMenu(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  const visibleGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  if (!allowed) {
    return (
      <div className="group-management">
        <div role="alert" className="group-status group-error">
          Admin or executive access is required.
        </div>
      </div>
    );
  }

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

      {errorMessage && (
        <div role="alert" className="group-status group-error">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="group-popup-overlay">
          <div className="group-popup">
            <h2>Changes Saved</h2>

            <p>{successMessage}</p>

            <button
              type="button"
              className="group-modal-primary-button"
              onClick={() => setSuccessMessage("")}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="group-search-row">
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          aria-label="Search groups"
          disabled={isSaving}
          placeholder="Search group..."
          className="group-search-input"
        />
      </div>

      <div className="group-content-box">
        <div className="group-add-section">
          <button
            onClick={addGroup}
            disabled={!hasLoaded || isSaving}
            className="group-add-button"
          >
            (+) Add Group
          </button>
        </div>

        <div className="group-table-header">
          <div>GROUP NAME</div>
          <div>MEMBERS</div>
          <div>ACTIONS</div>
        </div>

        {isLoading && <div className="group-status">Loading groups...</div>}

        {!isLoading && hasLoaded && visibleGroups.length === 0 && (
          <div className="group-status">No groups found.</div>
        )}

        {visibleGroups.map((group) => (
          <div key={group._id}>
            <div className="group-table-row">
              <div className="group-name">{group.name}</div>
              <div className="group-member-count">{group.members.length}</div>
              <div className="group-row-actions">
                <button
                  onClick={() => openEditor(group)}
                  disabled={isSaving}
                  aria-expanded={expandedGroup === group._id}
                  className="group-edit-button"
                >
                  Edit
                  <span className="group-edit-arrow">
                    {expandedGroup === group._id ? "▴" : "▾"}
                  </span>
                </button>

                <div className="group-more-menu-wrapper">
                  <button
                    type="button"
                    className="group-more-button"
                    aria-label={`More actions for ${group.name}`}
                    aria-expanded={openGroupMenu === group._id}
                    onClick={() =>
                      setOpenGroupMenu(
                        openGroupMenu === group._id ? null : group._id
                      )
                    }
                  >
                    <span></span>
                    <span></span>
                    <span></span>
                  </button>

                  {openGroupMenu === group._id && (
                    <div className="group-more-menu">
                      <button
                        type="button"
                        onClick={() => openGroupModal("rename", group)}
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        className="group-more-menu-delete"
                        onClick={() => openGroupModal("delete", group)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {expandedGroup === group._id && (
              <div className="group-member-panel">
                <label className="group-name-field">
                  <span className="group-manager-label">Group Name</span>

                  <input
                    type="text"
                    aria-label="Group name"
                    className="group-name-input"
                    value={draftName}
                    disabled={isSaving}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>
                <label
                  className="group-manager-label"
                  htmlFor={`manager-${group._id}`}
                >
                  Group Manager
                </label>
                <select
                  id={`manager-${group._id}`}
                  className="group-manager-select"
                  disabled={isSaving}
                  value={draftManager}
                  onChange={(event) => setDraftManager(event.target.value)}
                >
                  <option value="">No manager</option>
                  {people.map((person) => (
                    <option key={person._id} value={person._id}>
                      {getUserName(person)}
                    </option>
                  ))}
                </select>

                <div className="group-member-title">Members</div>
                <div className="group-member-grid">
                  {people.map((person) => {
                    const isChecked = draftMembers.includes(person._id);

                    return (
                      <label key={person._id} className="group-member-label">
                        <input
                          type="checkbox"
                          disabled={isSaving}
                          checked={isChecked}
                          onChange={() => toggleMember(person._id)}
                          className="group-member-checkbox-input"
                        />
                        <span
                          className={`group-member-checkbox ${isChecked ? "checked" : ""
                            }`}
                        >
                          {isChecked ? "✓" : ""}
                        </span>
                        <span className="group-member-name">
                          {getUserName(person)}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="group-action-row">
                  <span className="group-member-help">
                    Select existing users as members of this group.
                  </span>
                  <div className="group-action-buttons">
                    <button
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="group-cancel-button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveChanges(group._id)}
                      disabled={isSaving}
                      className="group-save-button"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>


      {groupModalAction && (
        <div className="group-popup-overlay">
          <div
            className="group-popup"
            role="dialog"
            aria-modal="true"
          >
            <h2>
              {groupModalAction === "create" && "Add Group"}
              {groupModalAction === "rename" && "Rename Group"}
              {groupModalAction === "delete" && "Delete Group"}
            </h2>

            {groupModalAction === "delete" ? (
              <p>
                Are you sure you want to delete{" "}
                <strong>{groupModalGroup?.name}</strong>?
              </p>
            ) : (
              <>
                <p>
                  {groupModalAction === "create"
                    ? "Enter a name for the new group."
                    : "Enter the new group name."}
                </p>

                <input
                  type="text"
                  className="group-modal-input"
                  value={groupModalName}
                  onChange={(event) =>
                    setGroupModalName(event.target.value)
                  }
                  autoFocus
                />
              </>
            )}

            <div className="group-modal-actions">
              <button
                type="button"
                className="group-modal-cancel-button"
                onClick={closeGroupModal}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  groupModalAction === "delete"
                    ? "group-modal-delete-button"
                    : "group-modal-primary-button"
                }
                onClick={changeGroup}
                disabled={
                  isSaving ||
                  ((groupModalAction === "create" ||
                    groupModalAction === "rename") &&
                    !groupModalName.trim())
                }
              >
                {isSaving
                  ? "Saving..."
                  : groupModalAction === "create"
                    ? "Add Group"
                    : groupModalAction === "rename"
                      ? "Rename"
                      : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default GroupManagement;

