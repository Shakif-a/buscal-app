import axios from "axios";
const API_URL = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/okr`;

async function getReport(token) {
  const response = await axios.get(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

async function getMyPermissions(token) {
  const response = await axios.get(`${API_URL}/permissions/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.permissions;
}

export default { getReport, getMyPermissions };
