import React from "react";
import "./Report.css";


function Report(){

  return (
    <div className="report">
      
      <div className="report-header">
          <div className="report-title">
              {/*Arrow Logo */}
              <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"
              />
              <h1>Dashboard</h1>

          </div>
              <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
      </div>

      <div className="statistics">
          <div className="cards">
            <p>Total Objectives</p>
            <h2>24</h2>
            <span>Across 3 groups</span>

          </div>

          <div className="cards">
            <p>Completed</p>
            <h2>65%</h2>
            <span>16 of 24 objectives</span>

          </div>

          <div className="cards">
            <p>At Risk Objectives</p>
            <h2>5</h2>
            <span>Need attention this week</span>

          </div>
      </div>

      <div className="bottom-section">
          <div className="week-statistics">
            <h3>Current Week Statistics</h3>

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

      <div>
        <p></p>
      </div>

      <div className="completion-overview">
        <h3>Completion Overview</h3>
        <div className="graph-container">
          <div className="circle">
            <h4>72%</h4>
            <p>On Track</p>
          </div>
          <div className="circlee">
            <h2>65%</h2>
            <p className="texter">Overall Completed</p>
          </div>
          <div className="circle">
            <h4>21%</h4>
            <p>At Risk</p>
          </div>
        </div>

      </div>
      
    </div>

  );

}
export default Report;