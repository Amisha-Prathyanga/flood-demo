// File: src/components/RightPanel.jsx
import React from "react";
import { FiMapPin, FiActivity, FiAlertTriangle, FiCheckCircle, FiLoader } from "react-icons/fi";
import { BiLayer } from "react-icons/bi";

const RISK_LEVELS = {
  both:    { label: "Repeatedly Flooded",   color: "#ef4444", bg: "rgba(239,68,68,0.12)",   icon: "🔴" },
  only2025:{ label: "Flooded in 2025 Only", color: "#f97316", bg: "rgba(249,115,22,0.12)",  icon: "🟠" },
  onlyPast:{ label: "Flooded in Past Events Only", color: "#eab308", bg: "rgba(234,179,8,0.12)", icon: "🟡" },
  none:    { label: "No Flood Record Found",color: "#22c55e", bg: "rgba(34,197,94,0.12)",   icon: "🟢" },
};

const YearBadge = ({ label, affected, loading }) => {
  const color = affected ? "#ef4444" : "#22c55e";
  const bg    = affected ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.10)";
  const text  = loading ? "Checking…" : affected ? "✓ Affected" : "✗ Not Affected";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: "8px",
        background: loading ? "rgba(255,255,255,0.05)" : bg,
        border: `1px solid ${loading ? "rgba(255,255,255,0.08)" : color + "55"}`,
        marginBottom: "8px",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{label}</span>
      <span
        style={{
          fontWeight: 700,
          fontSize: "0.8rem",
          color: loading ? "var(--text-secondary)" : color,
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {loading ? <FiLoader style={{ animation: "spin 1s linear infinite" }} /> : null}
        {text}
      </span>
    </div>
  );
};

const RightPanel = ({ pointAnalysis }) => {
  const getRiskLevel = () => {
    if (!pointAnalysis || pointAnalysis.loading || pointAnalysis.error) return null;
    if (pointAnalysis.flood2025 && pointAnalysis.pastFlood) return RISK_LEVELS.both;
    if (pointAnalysis.flood2025) return RISK_LEVELS.only2025;
    if (pointAnalysis.pastFlood) return RISK_LEVELS.onlyPast;
    return RISK_LEVELS.none;
  };

  const risk = getRiskLevel();

  return (
    <div className="glass-panel right-panel">
      <div className="panel-header">
        <h2>
          <FiActivity /> Flood History
        </h2>
      </div>

      <div className="panel-content">
        {!pointAnalysis ? (
          /* Empty state */
          <div className="empty-state">
            <BiLayer />
            <div>
              <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                No Location Selected
              </p>
              <p style={{ fontSize: "0.875rem", marginTop: "4px" }}>
                Click anywhere on the map, or enter coordinates in the left panel to check flood history.
              </p>
            </div>
          </div>
        ) : pointAnalysis.error ? (
          <div className="empty-state" style={{ color: "var(--danger-color)" }}>
            <FiAlertTriangle style={{ fontSize: "2rem" }} />
            <div>
              <p style={{ fontWeight: 500 }}>Query Failed</p>
              <p style={{ fontSize: "0.875rem", marginTop: "4px" }}>
                Could not retrieve flood data. Please try again.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Coordinates */}
            <div className="stat-card full-width" style={{ marginBottom: "1rem" }}>
              <span className="stat-label">
                <FiMapPin style={{ display: "inline", marginRight: "4px" }} />
                Selected Location
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-primary)", marginTop: "4px" }}>
                {pointAnalysis.lat?.toFixed(5)}° N, {pointAnalysis.lng?.toFixed(5)}° E
              </span>
            </div>

            {/* Year-by-year comparison */}
            <div className="section">
              <h3 className="section-title">Flood Exposure by Year</h3>

              <YearBadge
                label="2025 (Nov) — Multisensor"
                affected={pointAnalysis.flood2025}
                loading={pointAnalysis.loading}
              />
              <YearBadge
                label="2016 / 2018 — Past Events"
                affected={pointAnalysis.pastFlood}
                loading={pointAnalysis.loading}
              />
            </div>

            {/* Risk summary */}
            {risk && !pointAnalysis.loading && (
              <div className="section" style={{ marginTop: "1rem" }}>
                <h3 className="section-title">Combined Risk Assessment</h3>
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: risk.bg,
                    border: `1px solid ${risk.color}55`,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>{risk.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: risk.color, fontSize: "0.95rem" }}>
                      {risk.label}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "3px" }}>
                      {risk === RISK_LEVELS.both
                        ? "This area has been affected by flooding in multiple periods."
                        : risk === RISK_LEVELS.only2025
                        ? "This area was affected by the November 2025 floods only."
                        : risk === RISK_LEVELS.onlyPast
                        ? "This area was affected in past events (2016/2018) but not in 2025."
                        : "This point falls outside all recorded flood extents."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading spinner overlay for risk section */}
            {pointAnalysis.loading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  marginTop: "1rem",
                  padding: "0 4px",
                }}
              >
                <FiLoader style={{ animation: "spin 1s linear infinite" }} />
                Querying flood layers…
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
