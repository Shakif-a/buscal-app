import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { getObjectives } from "../../features/objectives/objectiveSlice";
import {
  TIME_FRAMES,
  filterByScope,
  getDashboardStats,
  getScopes,
} from "../../features/objectives/dashboardStats";
import useMyPermissions from "../../features/users/useMyPermissions";
import AtAGlance from "./AtAGlance";
import "./OkrDashboard.css";

// Reload the objectives every 5 minutes so time based statuses (at risk, overdue) stay current
const KIOSK_REFRESH_MS = 5 * 60 * 1000;

// At a Glance on its own, for a screen left on all day (e.g. at the front entrance).
// Filters come from the URL: ?scope=all|groups|mine&time=all|this-week|next-week
function OkrKiosk() {
  const dispatch = useDispatch();
  const { objectives, isError, message } = useSelector((state) => state.okr);
  const { user } = useSelector((state) => state.auth);
  const { scopes, defaultScope } = getScopes(useMyPermissions(user?.token));
  const [searchParams] = useSearchParams();
  const [updatedAt, setUpdatedAt] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const scope =
    scopes.find((item) => item.key === searchParams.get("scope")) ||
    scopes.find((item) => item.key === defaultScope);
  const timeFrame =
    TIME_FRAMES.find((item) => item.key === searchParams.get("time")) || TIME_FRAMES[0];

  useEffect(() => {
    const load = () => {
      dispatch(getObjectives()).then(() => setUpdatedAt(new Date()));
    };
    load();
    const timer = setInterval(load, KIOSK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [dispatch]);

  // Track full screen, including when it's left with Esc
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  const stats = useMemo(() => {
    const scoped = filterByScope(objectives, scope.key, timeFrame.key);
    return getDashboardStats(scoped.objectives, scoped.keyResults, new Date(), timeFrame.key);
  }, [objectives, scope.key, timeFrame.key]);

  return (
    <div className="okr-kiosk">
      <div className="kiosk-info">
        <span>
          Ownership ({scope.label}) · Time ({timeFrame.label})
        </span>
        <span className="kiosk-actions">
          {updatedAt && (
            <span>
              Updated{" "}
              {updatedAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            className="fullscreen-button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </button>
        </span>
      </div>
      {isError && <p role="alert">{message || "Could not load objectives"}</p>}
      <AtAGlance
        stats={stats}
        timeFrame={timeFrame.key}
        selected={null}
        onSelectSlice={() => {}}
        kiosk
      />
    </div>
  );
}

export default OkrKiosk;
