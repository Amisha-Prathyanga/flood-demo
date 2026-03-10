import React from "react";
import { FiSearch, FiFilter, FiLayers } from "react-icons/fi";

const LeftPanel = ({ filters, onFilterChange }) => {
  const handleLevelChange = (e) => {
    onFilterChange({ damageLevel: e.target.value });
  };

  const handleSearchChange = (e) => {
    onFilterChange({ searchId: e.target.value });
  };

  const handleStatusChange = (e) => {
    onFilterChange({ floodStatus: e.target.value });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Normally we could trigger a zoom here, but we will let the MapWidget handle
    // the zoom when `filters.searchId` changes, or we can add a specific event.
    // For now, setting the state will trigger a reaction in MapWidget.
  };

  return (
    <div className="glass-panel left-panel">
      <div className="panel-header">
        <h2>
          <FiFilter /> Filters & Search
        </h2>
      </div>

      <div className="panel-content">
        <div className="section">
          <h3 className="section-title">Property Search</h3>
          <form className="input-group" onSubmit={handleSearchSubmit}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search by Building ID..."
                value={filters.searchId || ""}
                onChange={handleSearchChange}
              />
              <button
                type="submit"
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <FiSearch />
              </button>
            </div>
          </form>
        </div>

        <div className="divider"></div>

        <div className="section">
          <h3 className="section-title">
            <FiLayers style={{ display: "inline", marginRight: "6px" }} /> Map
            Filters
          </h3>

          <div className="input-group" style={{ marginBottom: "1.25rem" }}>
            <label htmlFor="floodStatus">Flood Status</label>
            <select
              id="floodStatus"
              value={filters.floodStatus}
              onChange={handleStatusChange}
            >
              <option value="all">All Buildings</option>
              <option value="affected">Flood Affected</option>
              <option value="safe">Not Affected</option>
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="damageLevel">Damage Category</label>
            <select
              id="damageLevel"
              value={filters.damageLevel}
              onChange={handleLevelChange}
            >
              <option value="all">All Damage Levels</option>
              <option value="severe">Severe</option>
              <option value="moderate">Moderate</option>
              <option value="minor">Minor</option>
              <option value="none">No Damage</option>
            </select>
          </div>
        </div>

        {/* Can add more specific filters here like depth ranges if they exist in the dataset */}

        <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
          <div
            className="stat-card"
            style={{
              background: "rgba(59, 130, 246, 0.1)",
              borderColor: "rgba(59, 130, 246, 0.2)",
            }}
          >
            <span
              className="stat-label"
              style={{ color: "var(--brand-color)" }}
            >
              Demo Layer
            </span>
            <span
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                marginTop: "4px",
              }}
            >
              Kelaniya River Flood 2025
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftPanel;
