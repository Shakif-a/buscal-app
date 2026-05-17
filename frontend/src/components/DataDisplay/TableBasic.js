import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import GridLegacy from "@mui/material/GridLegacy";

{
  /* <TableBasic
    labels={['Food', 'Calories', 'Protein', 'Fats', 'Carbs']}
    content={
        [
            {
                tableData: ['Frozen yoghurt', 30, 5, 3, 4],//users.map(user => user.email);
            },
            {
                tableData: ['Ice cream sandwich', 555, 30, 5, 3],
            },
        ]
    }
/>  */
}

export default function TableBasic({ labels, content }) {
  return (
    <GridLegacy
      container
      spacing={{ xs: 2, md: 3, lg: 1 }}
      columns={{ xs: 3, sm: 4, md: 12, lg: 12 }}
    >
      <GridLegacy item xs={3} sm={4} md={12} lg={12}>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 280 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                {labels.map((value, length) => (
                  <TableCell key={length}>{value}</TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {content.map((val, length) => (
                <TableRow
                  key={length}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  {val.tableData.map((value, length) => (
                    <TableCell component="th" scope="row" key={length}>
                      {value}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GridLegacy>
    </GridLegacy>
  );
}
