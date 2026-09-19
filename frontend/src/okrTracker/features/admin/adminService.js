import axios from "axios";

const API_URL = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/okr/admin`;

function getConfig(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

async function getUsers(token) {
  const response = await axios.get(`${API_URL}/users`, getConfig(token));
  return response.data;
}

async function getGroups(token) {
  const response = await axios.get(`${API_URL}/groups`, getConfig(token));
  return response.data;
}

async function createGroup(name, token) {
  const response = await axios.post(
    `${API_URL}/groups`,
    { name },
    getConfig(token),
  );

  return response.data;
}

async function updateGroup(groupId, groupData, token) {
  const response = await axios.put(
    `${API_URL}/groups/${groupId}`,
    groupData,
    getConfig(token),
  );

  return response.data;
}

async function getPermissions(token) {
  const response = await axios.get(`${API_URL}/permissions`, getConfig(token));
  return response.data;
}

async function getRoles(token) {
  const response = await axios.get(`${API_URL}/roles`, getConfig(token));
  return response.data;
}

async function createRole(role, token) {
  const response = await axios.post(
    `${API_URL}/roles`,
    { role },
    getConfig(token),
  );
  return response.data;
}

async function renameRole(role, name, token) {
  const response = await axios.put(
    `${API_URL}/roles/${encodeURIComponent(role)}`,
    { role: name },
    getConfig(token),
  );
  return response.data;
}

async function deleteRole(role, token) {
  const response = await axios.delete(
    `${API_URL}/roles/${encodeURIComponent(role)}`,
    getConfig(token),
  );
  return response.data;
}

async function assignRole(userId, role, token) {
  const response = await axios.put(
    `${API_URL}/users/${userId}/role`,
    { role },
    getConfig(token),
  );
  return response.data;
}

async function deleteGroup(groupId, token) {
  const response = await axios.delete(
    `${API_URL}/groups/${groupId}`,
    getConfig(token),
  );
  return response.data;
}

async function updatePermissions(role, permissions, token) {
  const response = await axios.put(
    `${API_URL}/permissions/${encodeURIComponent(role)}`,
    { permissions },
    getConfig(token),
  );

  return response.data;
}

const adminService = {
  getRoles,
  createRole,
  renameRole,
  deleteRole,
  assignRole,
  deleteGroup,
  createGroup,
  getGroups,
  getPermissions,
  getUsers,
  updateGroup,
  updatePermissions,
};

export default adminService;
