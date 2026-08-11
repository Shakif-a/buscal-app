import React from "react";
import "./Reports.css";


function Reports(){

  return (
    <div className="reports">
      
      <div className="report-header">
          <div className="report-title">
              {/*Arrow Logo */}
              <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"
              />
              <h1>Reports</h1>

          </div>
              <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
      </div>

      <div className="statistics">
          <div className="cards cards-blue">
            <div className="cards-line"></div>
            <p>Objectives On Track</p>
            <h2>14</h2>

          </div>

          <div className="cards cards-green">
            <div className="cards-line"></div>
            <p>Average Completed</p>
            <h2>65%</h2>

          </div>

          <div className="cards cards-navy">
            <div className="cards-line"></div>
            <p>Reports Exported</p>
            <h2>8</h2>

          </div>
      </div>

      <div className="bottom-section">
          <div className="week-statistics">
            <h3>Completion By Group - This Quarter</h3>

            <div className="progress-row">
              <span>R &amp; D</span>
              <progress value="78" max="100"></progress>
              <span>78%</span>
            </div>

            <div className="progress-row">
              <span>Sales</span>
              <progress value="62" max="100"></progress>
              <span>62%</span>
            </div>

            <div className="progress-row">
              <span>Marketing</span>
              <progress value="54" max="100"></progress>
              <span>54%</span>
            </div>

            <div className="progress-row">
              <span>Tech</span>
              <progress value="100" max="100"></progress>
              <span>100%</span>
            </div>

            <div className="progress-row">
              <span>Operations</span>
              <progress value="41" max="100"></progress>
              <span>41%</span>
            </div>
          </div>

      </div>

      <div className="export-container">
        <button type="button" className="export-button"
        onClick={() => alert("Your report has been exported successfully.")}>
                Export Reports
              </button>
      </div>
      
    </div>

  );

}
export default Reports;