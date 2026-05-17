import React from "react";
import { Button } from "@mui/material";
import OrgTree from "../../components/DataDisplay/OrgTree";
import useOrgChart from "../../hooks/useOrgChart";

const PrintChart = () => {
  const { generateOrgChart } = useOrgChart();
  const orgChartData = generateOrgChart();

  return (
    <div>
      <Button variant="contained" color="primary">
        Print Chart
      </Button>
      <div>
        <OrgTree data={orgChartData} />
      </div>
    </div>
  );
};

export default PrintChart;
