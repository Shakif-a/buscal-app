import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS--------------------------------------
//-----------------------------------------------------------------------------------

// Function to get all users.
// Backend returns a raw array of User documents (see getUser in
// userController.js), not wrapped in an object.
const getUsers = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(API_URL + "/api/users/user", config);

  return response.data;
};

const userService = {
  getUsers,
};

export default userService;