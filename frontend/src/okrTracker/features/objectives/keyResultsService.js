import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS--------------------------------------
//-----------------------------------------------------------------------------------

// Get all key results for an objective
const getKeyResultsByObjective = async (objectiveId, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(
    `${API_URL}/api/okrTracker/objectives/${objectiveId}/key-results`,
    config
  );

  return response.data;
};

// Get a single key result
const getKeyResultById = async (objectiveId, keyResultId, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(
    `${API_URL}/api/okrTracker/objectives/${objectiveId}/key-results/${keyResultId}`,
    config
  );

  return response.data;
};

//-----------------------------------------------------------------------------------
//--------------------------------------CREATORS-------------------------------------
//-----------------------------------------------------------------------------------

// Create a new key result
const createKeyResult = async (objectiveId, keyResultData, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.post(
    `${API_URL}/api/okrTracker/objectives/${objectiveId}/key-results`,
    keyResultData,
    config
  );

  return response.data;
};

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS-------------------------------------
//-----------------------------------------------------------------------------------

// Delete a key result
const deleteKeyResult = async (objectiveId, keyResultId, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.delete(
    `${API_URL}/api/okrTracker/objectives/${objectiveId}/key-results/${keyResultId}`,
    config
  );

  return response.data;
};

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS-------------------------------------
//-----------------------------------------------------------------------------------

// Update a key result
const updateKeyResult = async (objectiveId, keyResultId, keyResultData, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.put(
    `${API_URL}/api/okrTracker/objectives/${objectiveId}/key-results/${keyResultId}`,
    keyResultData,
    config
  );

  return response.data;
};

const keyResultService = {
  getKeyResultsByObjective,
  getKeyResultById,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
};

export default keyResultService;