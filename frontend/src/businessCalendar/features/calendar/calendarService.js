import axios from "axios";
const API_URL = "";

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS----------------------------------
//-----------------------------------------------------------------------------------

const getAllEntry = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(API_URL + "/api/calendar/entries", config);

  return response.data;
};

// Function to get a calendar entry by its ID
const getEntryById = async (entryId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.get(
      `${API_URL}/api/calendar/entries/${entryId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error("Error retrieving entry by ID:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

// Function to get all calendar entries for a specific user
const getUserEntries = async (userId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.get(
      `${API_URL}/api/calendar/entries/user/${userId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error("Error retrieving user entries:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

// Function to get all calendar entries for a supervisor
const getSupervisorEntries = async (supervisorId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.get(
      `${API_URL}/api/calendar/entries/supervisor/${supervisorId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error("Error retrieving supervisor entries:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

// Function to get all calendar histories
const getAllHistory = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(`${API_URL}/api/calendar/histories`, config);

  return response.data;
};

// Function to get a calendar history by its ID
const getHistoryById = async (historyId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.get(
      `${API_URL}/api/calendar/histories/${historyId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error("Error retrieving history by ID:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

// Function to handle file download with error handling
const handleDownload = async (fileId) => {
  try {
    // Fetch the file details first
    const fileDetailsResponse = await axios.get(
      `${API_URL}/api/all/getFile/${fileId}`
    );
    const { filename } = fileDetailsResponse.data;

    if (!filename) {
      throw new Error("File details not found");
    }

    // Now, download the file using the file name
    const response = await axios.get(`${API_URL}/api/all/download/${fileId}`, {
      responseType: "blob", // Important to handle the file download correctly
    });

    // Create a URL for the downloaded file
    const url = window.URL.createObjectURL(new Blob([response.data]));

    // Create a new anchor element
    const link = document.createElement("a");
    link.href = url;

    // Set the download attribute with the actual file name
    link.setAttribute("download", filename);

    // Append the anchor to the body (required for Firefox)
    document.body.appendChild(link);

    // Trigger the download by simulating a click
    link.click();

    // Clean up and remove the anchor element
    document.body.removeChild(link);

    // Revoke the object URL to free up memory
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
    alert("Failed to download the file. Please try again later."); // Provide user feedback
  }
};

const getFileDetailsById = async (fileId) => {
  try {
    const response = await fetch(`${API_URL}/api/all/getFile/${fileId}`);
    if (response.ok) {
      console.log("File fetched");
      const fileData = await response.json();
      return fileData;
    } else {
      console.error("Error fetching file data:", response.statusText);
      return null;
    }
  } catch (error) {
    console.error("Error fetching file data:", error);
    return null;
  }
};

//-----------------------------------------------------------------------------------
//--------------------------------------CREATORS----------------------------------
//-----------------------------------------------------------------------------------

const createEntry = async (entryData, token) => {
  // Define the configuration object with the Authorization header
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    // Make an HTTP POST request to the specified endpoint
    const response = await axios.post(
      API_URL + "/api/calendar/entries",
      entryData,
      config
    );

    // Log the response data to the console
    console.log("createEntry response.data: ", response.data);

    // Return the response data
    return response.data;
  } catch (error) {
    // Handle any errors that occur during the request
    console.error(
      "Error creating calendar entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const uploadFiles = async (formData) => {
  try {
    const response = await fetch(API_URL + "/api/all/upload", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data.fileIds; // Return the file IDs from the response
  } catch (error) {
    console.error("Error uploading files:", error);
    throw error; // Re-throw the error to handle it in the calling function
  }
};

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS----------------------------------
//-----------------------------------------------------------------------------------

const deleteEntry = async (entryId, token, notes) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { notes }, // Include notes in the request body
    };

    const response = await axios.delete(
      `${API_URL}/api/calendar/entries/${entryId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error deleting calendar entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const deleteRecurringEntries = async (entryId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.delete(
      `${API_URL}/api/calendar/entries/recur/${entryId}`,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error deleting recurring calendar entries:",
      error.response?.data || error.message
    );
    throw error;
  }
};

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS----------------------------------
//-----------------------------------------------------------------------------------

const updateEntry = async (entryId, entryData, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.put(
      `${API_URL}/api/calendar/entries/${entryId}`,
      entryData,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error updating calendar entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const updateRecurringEntries = async (entryId, entryData, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.put(
      `${API_URL}/api/calendar/entries/recur/${entryId}`,
      entryData,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error updating recurring calendar entries:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const reassignEntry = async (entryId, reassignmentData, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.put(
      `${API_URL}/api/calendar/entries/${entryId}/reassign`,
      reassignmentData,
      config
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error reassigning calendar entry:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const calendarService = {
  createEntry,
  getAllEntry,
  getEntryById,
  getUserEntries,
  getSupervisorEntries,
  getAllHistory,
  getHistoryById,
  uploadFiles,
  handleDownload,
  getFileDetailsById,
  deleteEntry,
  updateEntry,
  reassignEntry,
  updateRecurringEntries,
  deleteRecurringEntries,
};

export default calendarService;
