import React, { useState } from "react";
import { FiSearch, FiLayers, FiMapPin } from "react-icons/fi";

const LeftPanel = ({ filters, onFilterChange, onCoordSearch }) => {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [coordError, setCoordError] = useState("");

  const handleCoordSubmit = (e) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (
      isNaN(parsedLat) || isNaN(parsedLng) ||
      parsedLat < -90 || parsedLat > 90 ||
      parsedLng < -180 || parsedLng > 180
    ) {
      setCoordError("Enter valid coordinates (e.g. 6.9271, 79.8612)");
      return;
    }
    setCoordError("");
    onCoordSearch({ lat: parsedLat, lng: parsedLng });
  };

  return (
    <div className="glass-panel left-panel">
      <div className="panel-header">
        <h2>
          <FiMapPin /> Search &amp; Layers
        </h2>
      </div>

      <div className="panel-content">
        {/* Coordinate Search */}
        <div className="section">
          <h3 className="section-title">Search by Coordinates</h3>
          <form onSubmit={handleCoordSubmit}>
            <div className="input-group" style={{ marginBottom: "0.75rem" }}>
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 6.9271"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: "0.75rem" }}>
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 79.8612"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
            {coordError && (
              <p style={{ color: "var(--danger-color)", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                {coordError}
              </p>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.55rem 1rem",
                background: "var(--brand-color)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "opacity 0.15s",
              }}
            >
              <FiSearch /> Go to Location
            </button>
          </form>
          <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.6rem", lineHeight: 1.4 }}>
            Or click anywhere on the map to check flood history for that point.
          </p>
        </div>

        <div className="divider" />

        {/* Layer Toggles */}
        <div className="section">
          <h3 className="section-title">
            <FiLayers style={{ display: "inline", marginRight: "6px" }} />
            Map Layers
          </h3>

          <div className="input-group" style={{ marginBottom: "1.25rem" }}>
            <label>Basemap Style</label>
            <select
              value={filters.basemap || "dark-gray-vector"}
              onChange={(e) => onFilterChange({ basemap: e.target.value })}
            >
              <option value="dark-gray-vector">Dark Gray Canvas</option>
              <option value="satellite">Satellite</option>
              <option value="hybrid">Hybrid (Satellite + Labels)</option>
              <option value="streets-navigation-vector">Streets Navigation</option>
              <option value="osm">OpenStreetMap</option>
              <option value="topo-vector">Topographic</option>
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: "1.25rem" }}>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={filters.showFlood2025 !== false}
                onChange={(e) => onFilterChange({ showFlood2025: e.target.checked })}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span>Flood Extent 2025</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  Nov 2025 · Multisensor
                </span>
              </span>
            </label>
          </div>

          <div className="input-group" style={{ marginBottom: "1.25rem" }}>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={filters.showPastFlood !== false}
                onChange={(e) => onFilterChange({ showPastFlood: e.target.checked })}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span>Past Flood Events</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  2016 &amp; 2018 events
                </span>
              </span>
            </label>
          </div>

          <div className="input-group" style={{ marginBottom: "1.25rem" }}>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={filters.showOsmBuildings !== false}
                onChange={(e) => onFilterChange({ showOsmBuildings: e.target.checked })}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span>OSM Buildings</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  Visible when zoomed in
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Data Sources */}
        <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
          <div
            className="stat-card"
            style={{ background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.2)" }}
          >
            <span className="stat-label" style={{ color: "var(--brand-color)" }}>
              Data Sources
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.6 }}>
              Multisensor Flood Extent · Nov 2025
              <br />
              Past Flood Events · 2016 &amp; 2018
              <br />
              OSM Asia Buildings
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftPanel;
