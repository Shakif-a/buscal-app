import * as React from "react";
import { useEffect } from "react";

export default function PrintTable({ contents }) {
  useEffect(() => {
    printTable();
  }, []);

  function printTable() {
    console.log("PRINTING");
    // var originalContents = document.body.innerHTML;
    // var timestamp = new Date().getTime(); // Get a unique timestamp
    var printContents = document.getElementById("printableArea").innerHTML;

    // Add the timestamp to the id of the div
    // var uniqueId = "printableArea_" + timestamp;
    // printContents = printContents.replace(
    //   'id="printableArea"',
    //   'id="' + uniqueId + '"'
    // );

    document.body.innerHTML = printContents;

    window.print();

    // document.body.innerHTML = originalContents;

    return null;
  }

  return <div id="printableArea2">HI</div>;
}
