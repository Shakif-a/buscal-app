import axios from "axios";
const API_URL = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/okr`;

async function getReport(token) {
  const response = await axios.get(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export default { getReport };
