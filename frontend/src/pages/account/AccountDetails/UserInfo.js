import React, { useEffect } from "react";
import { useSelector } from "react-redux";

const UserInfo = (employee) => {
  const { users } = useSelector((state) => state.auth);

  const supervisorName = users.find(
    (user) => user._id === employee?.employee?.supervisor
  )?.email;

  const userInfo = [
    { property: "firstName", label: "First Name" },
    { property: "lastName", label: "Last Name" },
    { property: "exec", label: "Executive team?" },
    { property: "supervisor", label: "Supervisor" },
    { property: "roles", label: "Roles" },
    { property: "phoneNumber", label: "Phone Number" }, // Added for Phone Number
    { property: "companyRoles", label: "Company Roles" }, // Added for Company Role
    { property: "managementLevel", label: "Management Level" },
  ];

  const role1 = useEffect(() => {
    // console.log(employee);
    // console.log(supervisorName);
  }, [employee]);

  if (!employee || !employee.employee) {
    return null;
  }

  return (
    <div className="card max-w-fit">
      <div className="fields flex flex-wrap">
        {userInfo.map((field) => (
          <div key={field.property} className="field mr-3 mb-3">
            <label className="label mr-2" htmlFor={field.label}>
              {field.label}
            </label>

            {field.label === "Supervisor"
              ? supervisorName
                ? supervisorName
                : "N/A"
              : field.label === "Roles"
                ? employee?.employee[field?.property].map((role) => role + "; ")
                : field.label === "Company Roles"
                  ? employee?.employee[field?.property].map((companyRole) => (
                      <div key={companyRole._id}>{companyRole.role}</div>
                    ))
                  : field.label === "Management Level"
                    ? employee?.employee["companyRoles"].map((companyRole) => (
                        <div key={companyRole._id}>
                          {companyRole.managementLevel}
                        </div>
                      ))
                    : employee?.employee[field?.property]
                      ? employee?.employee[field?.property]
                      : "N/A"}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserInfo;
