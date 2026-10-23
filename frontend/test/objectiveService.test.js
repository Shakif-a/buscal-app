import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import objectiveService from "../src/okrTracker/features/objectives/objectiveService.js";
import objectiveReducer, {
  deleteObjective,
  updateObjective,
} from "../src/okrTracker/features/objectives/objectiveSlice.js";

test("objective edit and delete use the protected backend routes", async () => {
  const originalPut = axios.put;
  const originalDelete = axios.delete;
  const requests = [];

  axios.put = async (url, body, config) => {
    requests.push({ method: "PUT", url, body, config });
    return { data: { _id: "objective-1", ...body } };
  };

  axios.delete = async (url, config) => {
    requests.push({ method: "DELETE", url, config });
    return { data: { id: "objective-1" } };
  };

  const objectiveData = {
    title: "Improve customer service",
    dueDate: "2026-12-01",
    owner: "user-1",
    group: "Sales",
    commitmentType: "committed",
    description: "Reduce response times.",
  };

  try {
    const updatedObjective = await objectiveService.updateObjective(
      "objective-1",
      objectiveData,
      "test-token"
    );
    const deletedObjective = await objectiveService.deleteObjective(
      "objective-1",
      "test-token"
    );

    assert.equal(
      requests[0].url,
      "http://localhost:5000/api/okrTracker/objectives/objective-1"
    );
    assert.equal(requests[0].method, "PUT");
    assert.deepEqual(requests[0].body, objectiveData);
    assert.equal(
      requests[0].config.headers.Authorization,
      "Bearer test-token"
    );
    assert.equal(updatedObjective.title, objectiveData.title);

    assert.equal(
      requests[1].url,
      "http://localhost:5000/api/okrTracker/objectives/objective-1"
    );
    assert.equal(requests[1].method, "DELETE");
    assert.equal(
      requests[1].config.headers.Authorization,
      "Bearer test-token"
    );
    assert.deepEqual(deletedObjective, { id: "objective-1" });
  } finally {
    axios.put = originalPut;
    axios.delete = originalDelete;
  }
});

test("popup request errors keep the objectives page available", () => {
  const startingState = {
    objectives: [{ _id: "objective-1", title: "Original title" }],
    currentObjective: null,
    isError: false,
    isSuccess: false,
    isLoading: false,
    message: "",
  };

  const updateState = objectiveReducer(
    startingState,
    updateObjective.rejected(
      new Error("Update failed"),
      "request-1",
      {
        objectiveId: "objective-1",
        objectiveData: { title: "Changed title" },
      },
      "Update failed"
    )
  );

  const deleteState = objectiveReducer(
    startingState,
    deleteObjective.rejected(
      new Error("Delete failed"),
      "request-2",
      "objective-1",
      "Delete failed"
    )
  );

  assert.equal(updateState.isError, false);
  assert.equal(updateState.objectives[0].title, "Original title");
  assert.equal(updateState.message, "Update failed");

  assert.equal(deleteState.isError, false);
  assert.equal(deleteState.objectives.length, 1);
  assert.equal(deleteState.message, "Delete failed");
});
