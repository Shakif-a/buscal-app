import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS--------------------------------------
//-----------------------------------------------------------------------------------

// Function to get all objectives
const getObjectives = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(API_URL + "/api/okrTracker/objectives", config);

  return response.data;
};

// Function to get objective structural groups
const getObjectiveGroups = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(API_URL + "/api/okrTracker/objectives/groups", config);

  return response.data;
};

// Function to get an objective entry by its ID
const getObjectiveById = async (objectiveId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.get(
      `${API_URL}/api/okrTracker/objectives/${objectiveId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error("Error retrieving objective by ID:", error);
    throw error; // Re-throw the error to be handled by the slice caller
  }
};

//-----------------------------------------------------------------------------------
//--------------------------------------CREATORS-------------------------------------
//-----------------------------------------------------------------------------------

// Function to create a brand new objective entry
const createObjective = async (objectiveData, token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    const response = await axios.post(
      API_URL + "/api/okrTracker/objectives",
      objectiveData,
      config
    );

    console.log("createObjective response.data: ", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating objective entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS-------------------------------------
//-----------------------------------------------------------------------------------

// Function to remove an objective from the database
const deleteObjective = async (objectiveId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.delete(
      `${API_URL}/api/okrTracker/objectives/${objectiveId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error deleting objective entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS-------------------------------------
//-----------------------------------------------------------------------------------

// Function to modify an existing objective
const updateObjective = async (objectiveId, objectiveData, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.put(
      `${API_URL}/api/okrTracker/objectives/${objectiveId}`,
      objectiveData,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error updating objective entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const okrService = {
  getObjectives,
  getObjectiveGroups,
  getObjectiveById,
  createObjective,
  deleteObjective,
  updateObjective,
};

export default okrService;
