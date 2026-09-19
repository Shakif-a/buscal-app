import axios from "axios";
const API_URL = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/okr`;

async function create(objectiveId, data, token) {
  const response = await axios.post(
    `${API_URL}/objectives/${objectiveId}/key-results`,
    data,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

async function approve(objectiveId, keyResultId, approved, token) {
  const response = await axios.put(
    `${API_URL}/objectives/${objectiveId}/key-results/${keyResultId}/approval`,
    { approved },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export default { create, approve };
