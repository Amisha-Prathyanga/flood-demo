import React from "react";
import { FiHome, FiInfo, FiActivity, FiMapPin } from "react-icons/fi";
import { BiLayer } from "react-icons/bi";

const RightPanel = ({ selectedFeature, stats }) => {
  // Render damage distribution chart safely
  const renderChart = () => {
    const { total = 0, severe = 0, moderate = 0, minor = 0 } = stats || {};
    const hasData = total > 0;

    // Safely calculate percentages
    const severePct = hasData ? (severe / total) * 100 : 0;
    const moderatePct = hasData ? (moderate / total) * 100 : 0;
    const minorPct = hasData ? (minor / total) * 100 : 0;

    // Remaining is "No damage" or unknown
    const remainingPct = 100 - (severePct + moderatePct + minorPct);

    return (
      <div className="damage-distribution">
        <div className="progress-bar-container">
          <div
            className="progress-segment severe"
            style={{ width: `${severePct}%` }}
          ></div>
          <div
            className="progress-segment moderate"
            style={{ width: `${moderatePct}%` }}
          ></div>
          <div
            className="progress-segment minor"
            style={{ width: `${minorPct}%` }}
          ></div>
          <div
            className="progress-segment none"
            style={{ width: `${remainingPct}%` }}
          ></div>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color severe"></div>Severe ({severe})
          </div>
          <div className="legend-item">
            <div className="legend-color moderate"></div>Moderate ({moderate})
          </div>
          <div className="legend-item">
            <div className="legend-color minor"></div>Minor ({minor})
          </div>
        </div>
      </div>
    );
  };

  // Safe attribute rendering for property details
  const getBadgeClass = (status, category) => {
    if (
      status?.toLowerCase() === "affected" ||
      status?.toLowerCase() === "yes"
    ) {
      if (category?.toLowerCase() === "severe") return "danger";
      if (category?.toLowerCase() === "moderate") return "warning";
      return "danger";
    }
    return "success";
  };

  return (
    <div className="glass-panel right-panel">
      <div className="panel-header">
        <h2>
          <FiActivity /> Dashboard Statistics
        </h2>
      </div>

      <div className="panel-content" style={{ paddingBottom: "0" }}>
        <div className="stats-grid">
          <div className="stat-card full-width">
            <span className="stat-label">
              <FiHome /> Total Buildings in View
            </span>
            <span className="stat-value">
              {stats?.total?.toLocaleString() || 0}
            </span>
          </div>

          <div className="stat-card">
            <span
              className="stat-label"
              style={{ color: "var(--danger-color)" }}
            >
              Affected
            </span>
            <span className="stat-value danger">
              {stats?.affected?.toLocaleString() || 0}
            </span>
          </div>

          <div className="stat-card">
            <span
              className="stat-label"
              style={{ color: "var(--danger-color)" }}
            >
              Severe Damage
            </span>
            <span className="stat-value danger">
              {stats?.severe?.toLocaleString() || 0}
            </span>
          </div>
        </div>

        <div className="section" style={{ marginTop: "0.5rem" }}>
          <h3 className="section-title">Damage Distribution</h3>
          {renderChart()}
        </div>
      </div>

      <div
        className="panel-header"
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--surface-border)",
        }}
      >
        <h2>
          <FiInfo /> Property Details
        </h2>
      </div>

      <div className="panel-content">
        {selectedFeature ? (
          <div className="property-details">
            <div className="property-header">
              <div className="property-title">
                <span className="property-id">
                  ID: {selectedFeature.OBJECTID || "Unknown"}
                </span>
                <span className="property-name">
                  {selectedFeature.building ||
                    selectedFeature.name ||
                    "Building"}
                </span>
              </div>
              <span
                className={`badge ${selectedFeature.gridcode === 2 ? "danger" : "success"}`}
              >
                {selectedFeature.gridcode === 2 ? "Severe Damage" : "No Damage"}
              </span>
            </div>

            <div className="property-meta">
              <div className="meta-row">
                <span className="meta-label">Flood Status</span>
                <span className="meta-value">
                  {selectedFeature.gridcode === 2 ? "Affected" : "Not Affected"}
                </span>
              </div>

              <div className="meta-row">
                <span className="meta-label">Area / Location</span>
                <span
                  className="meta-value"
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <FiMapPin />{" "}
                  {selectedFeature.addr_city ||
                    selectedFeature.addr_full ||
                    "Kelaniya"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <BiLayer />
            <div>
              <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                No Property Selected
              </p>
              <p style={{ fontSize: "0.875rem", marginTop: "4px" }}>
                Click on a building on the map to view detailed insurance and
                damage information.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
