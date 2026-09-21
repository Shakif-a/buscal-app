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

function evidenceUrl(objectiveId, keyResultId) {
  return `${API_URL}/objectives/${objectiveId}/key-results/${keyResultId}/evidence`;
}

async function uploadEvidence(objectiveId, keyResultId, file, note, token) {
  const response = await axios.post(
    evidenceUrl(objectiveId, keyResultId),
    file,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "X-Evidence-Name": encodeURIComponent(file.name),
        "X-Evidence-Type": encodeURIComponent(
          file.type || "application/octet-stream",
        ),
        "X-Evidence-Note": encodeURIComponent(note.trim()),
      },
    },
  );
  return response.data;
}

async function getEvidence(objectiveId, keyResultId, token) {
  const response = await axios.get(evidenceUrl(objectiveId, keyResultId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

async function downloadEvidence(
  objectiveId,
  keyResultId,
  evidenceId,
  token,
) {
  const response = await axios.get(
    `${evidenceUrl(objectiveId, keyResultId)}/${evidenceId}/download`,
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    },
  );
  return response.data;
}

async function deleteEvidence(
  objectiveId,
  keyResultId,
  evidenceId,
  token,
) {
  const response = await axios.delete(
    `${evidenceUrl(objectiveId, keyResultId)}/${evidenceId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
}

export default {
  create,
  approve,
  uploadEvidence,
  getEvidence,
  downloadEvidence,
  deleteEvidence,
};
