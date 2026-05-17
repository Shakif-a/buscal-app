import React, { useState } from "react";
import { Button, DatePicker, Space } from "antd";
import { Checkbox, Select } from "antd";
import { Typography } from "@mui/material";

const { Option } = Select;

const FilterModal = ({ setFilterOptions, emailList, filterOptions }) => {
  const handleFilterChange = (key, value) => {
    setFilterOptions((prevOptions) => ({
      ...prevOptions,
      [key]: value,
    }));
    setOpen(false);
  };

  const { priority, completionStatus, users, categories } = filterOptions;
  const [open, setOpen] = useState(false);

  const onDateChange = (dateRange) => {
    if (dateRange) {
      const [startDate, endDate] = dateRange;
      const adjustedEndDate = endDate ? endDate.endOf("day") : null;
      handleFilterChange("startDate", startDate.toString());
      handleFilterChange("endDate", adjustedEndDate.toString());
    } else {
      handleFilterChange("startDate", null);
      handleFilterChange("endDate", null);
    }
  };

  const CATEGORIES = {
    general: "General",
    task: "Task",
    action: "Action",
    event: "Event",
    meeting: "Meeting",
    businessdeadline: "Business Deadline",
  };

  return (
    <div>
      <Typography variant="inherit" style={{ marginTop: 4 }}>
        Date Range
      </Typography>
      <Space direction="vertical" size={12}>
        <DatePicker.RangePicker onChange={onDateChange} />
      </Space>

      <div style={{ display: "flex", flexDirection: "row" }}>
        {/* Categories */}
        <div style={{ flex: 1 }}>
          <Typography variant="inherit" style={{ marginTop: 6 }}>
            Categories
          </Typography>
          <Checkbox.Group
            style={{ marginRight: "20px" }}
            onChange={(selectedCategories) =>
              handleFilterChange("categories", selectedCategories)
            }
            value={categories}
          >
            <div>
              {Object.keys(CATEGORIES).map((category) => (
                <Checkbox key={category} value={category}>
                  {CATEGORIES[category]}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </div>

        {/* Users */}
        <div style={{ flex: 1 }}>
          <Typography variant="inherit" style={{ marginTop: 6 }}>
            User Assigned
          </Typography>
          {/* Autocomplete for selecting multiple options from emailList */}
          <Select
            mode="multiple"
            style={{ width: 300 }}
            placeholder="Select users"
            optionLabelProp="label"
            onChange={(selectedUsers) =>
              handleFilterChange("users", selectedUsers)
            }
            value={users}
            open={open}
            onDropdownVisibleChange={(visible) => setOpen(visible)}
          >
            {emailList.map((email) => (
              <Option key={email} label={email}>
                {email}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      {/* Priority */}
      <div style={{ marginTop: 20 }}>
        <Typography variant="inherit">Priority</Typography>
        <Select
          style={{ width: 200 }}
          defaultValue="all"
          onChange={(selectedPriority) =>
            handleFilterChange("priority", selectedPriority)
          }
          value={priority}
        >
          <Option value="all">All</Option>
          <Option value="normal">Normal</Option>
          <Option value="high">High</Option>
        </Select>
      </div>

      {/* Completion Status */}
      <div style={{ marginTop: 20 }}>
        <Typography variant="inherit">Completion Status</Typography>
        <Select
          style={{ width: 200 }}
          defaultValue="all"
          onChange={(selectedStatus) =>
            handleFilterChange("completionStatus", selectedStatus)
          }
          value={completionStatus}
        >
          <Option value="all">All</Option>
          <Option value="not started">Not Started</Option>
          <Option value="in progress">In Progress</Option>
          <Option value="completed">Completed</Option>
          <Option value="cancelled">Cancelled</Option>
          <Option value="overdue">Overdue</Option>
        </Select>
      </div>
    </div>
  );
};

export default FilterModal;
