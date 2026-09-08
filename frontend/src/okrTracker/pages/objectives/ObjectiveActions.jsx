import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteObjective,
  updateObjective,
} from "../../features/objectives/objectiveSlice";
import objectiveService from "../../features/objectives/objectiveService";
import userService from "../../features/users/userService";

function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().split("T")[0];
}

function getErrorMessage(error, fallbackMessage) {
  if (typeof error === "string") {
    return error;
  }

  if (error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function ObjectiveActions({ objective }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const menuRef = useRef(null);

  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [actionError, setActionError] = useState("");
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [owner, setOwner] = useState("");
  const [group, setGroup] = useState("");
  const [commitmentType, setCommitmentType] = useState("committed");
  const [description, setDescription] = useState("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function loadEditOptions() {
    if (!user?.token) {
      setActionError("Your session has expired. Please log in again.");
      return;
    }

    try {
      setIsLoadingOptions(true);

      const groupsData = await objectiveService.getObjectiveGroups(user.token);
      const usersData = await userService.getUsers(user.token);

      if (Array.isArray(groupsData)) {
        setGroupOptions(groupsData);
      } else {
        setGroupOptions(groupsData.groups || []);
      }

      if (Array.isArray(usersData)) {
        setOwnerOptions(usersData);
      } else {
        setOwnerOptions([]);
      }
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Could not load the owner and group options.")
      );
    } finally {
      setIsLoadingOptions(false);
    }
  }

  function openEditModal() {
    setTitle(objective.title || "");
    setDueDate(formatDate(objective.dueDate));
    setOwner(objective.owner?._id || objective.owner || "");
    setGroup(objective.group || "");
    setCommitmentType(objective.commitmentType || "committed");
    setDescription(objective.description || "");
    setActionError("");
    setShowMenu(false);
    setShowEditModal(true);
    loadEditOptions();
  }

  function openDeleteModal() {
    setActionError("");
    setShowMenu(false);
    setShowDeleteModal(true);
  }

  function closeEditModal() {
    if (!isSaving) {
      setShowEditModal(false);
      setActionError("");
    }
  }

  function closeDeleteModal() {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setActionError("");
    }
  }

  async function handleUpdateObjective(event) {
    event.preventDefault();

    if (!title.trim() || !dueDate || !owner || !group || !commitmentType) {
      setActionError("Please complete all required fields.");
      return;
    }

    const objectiveId = objective._id || objective.id;

    if (!objectiveId) {
      setActionError("This objective could not be found.");
      return;
    }

    try {
      setIsSaving(true);
      setActionError("");

      await dispatch(
        updateObjective({
          objectiveId,
          objectiveData: {
            title: title.trim(),
            dueDate,
            owner,
            group,
            commitmentType,
            description: description.trim(),
          },
        })
      ).unwrap();

      setShowEditModal(false);
    } catch (error) {
      setActionError(
        getErrorMessage(error, "The objective could not be updated.")
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteObjective() {
    const objectiveId = objective._id || objective.id;

    if (!objectiveId) {
      setActionError("This objective could not be found.");
      return;
    }

    try {
      setIsDeleting(true);
      setActionError("");

      await dispatch(deleteObjective(objectiveId)).unwrap();
      setShowDeleteModal(false);
    } catch (error) {
      setActionError(
        getErrorMessage(error, "The objective could not be deleted.")
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="objective-menu-container" ref={menuRef}>
        <button
          type="button"
          className="objective-menu-button"
          aria-label={`Actions for ${objective.title}`}
          onClick={() => setShowMenu(!showMenu)}
        >
          ...
        </button>

        {showMenu && (
          <div className="objective-menu-dropdown">
            <button
              type="button"
              className="objective-menu-item"
              onClick={openEditModal}
            >
              Edit
            </button>

            <button
              type="button"
              className="objective-menu-item delete-menu-item"
              onClick={openDeleteModal}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="popup-overlay" role="dialog" aria-modal="true">
          <div className="delete-objective-popup">
            <h2>Delete Objective</h2>
            <p>
              Are you sure you want to delete <strong>{objective.title}</strong>?
            </p>
            <p className="delete-warning">
              Its key results will also be deleted. This action cannot be undone.
            </p>

            {actionError && <p className="objective-action-error">{actionError}</p>}

            <div className="popup-buttons">
              <button
                type="button"
                className="popup-cancel-button"
                disabled={isDeleting}
                onClick={closeDeleteModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="popup-delete-button"
                disabled={isDeleting}
                onClick={handleDeleteObjective}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="edit-popup-overlay" role="dialog" aria-modal="true">
          <div className="edit-objective-popup">
            <div className="edit-popup-header">
              <h2>Edit Objective</h2>

              <button
                type="button"
                className="edit-popup-close"
                aria-label="Close edit objective popup"
                disabled={isSaving}
                onClick={closeEditModal}
              >
                x
              </button>
            </div>

            <form onSubmit={handleUpdateObjective}>
              <div className="edit-objective-form">
                <div className="edit-form-left">
                  <label htmlFor="edit-objective-title">Title</label>
                  <input
                    id="edit-objective-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />

                  <label htmlFor="edit-objective-date">Due Date</label>
                  <input
                    id="edit-objective-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />

                  <label htmlFor="edit-objective-owner">Owner</label>
                  <select
                    id="edit-objective-owner"
                    value={owner}
                    disabled={isLoadingOptions}
                    onChange={(event) => setOwner(event.target.value)}
                  >
                    <option value="">Select an owner</option>
                    {ownerOptions.map((ownerOption) => (
                      <option key={ownerOption._id} value={ownerOption._id}>
                        {[ownerOption.firstName, ownerOption.lastName]
                          .filter(Boolean)
                          .join(" ") || ownerOption.email}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="edit-objective-group">Group</label>
                  <select
                    id="edit-objective-group"
                    value={group}
                    disabled={isLoadingOptions}
                    onChange={(event) => setGroup(event.target.value)}
                  >
                    <option value="">Select a group</option>
                    {groupOptions.map((groupOption) => (
                      <option key={groupOption} value={groupOption}>
                        {groupOption}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="edit-objective-type">Type</label>
                  <select
                    id="edit-objective-type"
                    value={commitmentType}
                    onChange={(event) => setCommitmentType(event.target.value)}
                  >
                    <option value="committed">Committed</option>
                    <option value="aspirational">Aspirational</option>
                  </select>
                </div>

                <div className="edit-form-right">
                  <label htmlFor="edit-objective-description">Description</label>
                  <textarea
                    id="edit-objective-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </div>

              {actionError && (
                <p className="objective-action-error">{actionError}</p>
              )}

              <div className="edit-popup-buttons">
                <button
                  type="button"
                  className="edit-cancel-button"
                  disabled={isSaving}
                  onClick={closeEditModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="edit-save-button"
                  disabled={isSaving || isLoadingOptions}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default ObjectiveActions;
