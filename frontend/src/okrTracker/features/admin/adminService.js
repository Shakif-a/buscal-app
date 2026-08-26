import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/okr/admin`;

function getConfig() {
  const savedUser = localStorage.getItem("user");
  let token = "";

  if (savedUser) {
    const user = JSON.parse(savedUser);
    token = user.token;
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

async function getUsers() {
  const response = await axios.get(`${API_URL}/users`, getConfig());
  return response.data;
}

async function getGroups() {
  const response = await axios.get(`${API_URL}/groups`, getConfig());
  return response.data;
}

async function createGroup(name) {
  const response = await axios.post(`${API_URL}/groups`, { name }, getConfig());
  return response.data;
}

async function updateGroup(groupId, group) {
  const response = await axios.put(
    `${API_URL}/groups/${groupId}`,
    group,
    getConfig()
  );
  return response.data;
}

async function getPermissions() {
  const response = await axios.get(`${API_URL}/permissions`, getConfig());
  return response.data;
}

async function updatePermissions(role, permissions) {
  const response = await axios.put(
    `${API_URL}/permissions/${role}`,
    { permissions },
    getConfig()
  );
  return response.data;
}

const adminService = {
  createGroup,
  getGroups,
  getPermissions,
  getUsers,
  updateGroup,
  updatePermissions,
};

export default adminService;
