// File: src/App.jsx
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import "./index.css";
import {
  FiAlertTriangle,
  FiAlertCircle,
  FiClock,
  FiCheckCircle,
  FiBookmark,
  FiPrinter,
  FiTrash2,
} from "react-icons/fi";

const MapWidget = lazy(() => import("./components/MapWidget"));

function MapLoader() {
  return (
    <div className="map-loader-skeleton">
      <div className="skeleton-pulse-ring"></div>
      <div className="map-loader-text">
        <h3>Loading Interactive Map...</h3>
        <p>Initializing geospatial data layers</p>
      </div>
      <div className="skeleton-compass"></div>
      <div className="skeleton-zoom"></div>
    </div>
  );
}

const RISK = {
  both: {
    label: "Repeatedly Flooded",
    color: "#d83020",
    bg: "rgba(216,48,32,0.07)",
    border: "rgba(216,48,32,0.22)",
    icon: <FiAlertTriangle />,
    desc: "High ongoing flood risk — affected in multiple periods.",
  },
  only2025: {
    label: "Flooded in 2025 Only",
    color: "#c87137",
    bg: "rgba(200,113,55,0.07)",
    border: "rgba(200,113,55,0.22)",
    icon: <FiAlertCircle />,
    desc: "Affected by November 2025 floods.",
  },
  onlyPast: {
    label: "Past Exposure Only",
    color: "#a07d00",
    bg: "rgba(160,125,0,0.07)",
    border: "rgba(160,125,0,0.22)",
    icon: <FiClock />,
    desc: "Historical flood exposure in 2016/2018.",
  },
  none: {
    label: "No Flood Record",
    color: "#288835",
    bg: "rgba(40,136,53,0.07)",
    border: "rgba(40,136,53,0.22)",
    icon: <FiCheckCircle />,
    desc: "Outside all recorded flood extents.",
  },
};

const LAYERS = [
  {
    key: "showDsd",
    label: "DSD",
    fill: "rgba(173,216,230,0.15)",
    stroke: "rgba(60,100,160,0.85)",
  },
  {
    key: "showFlood2025",
    label: "2025",
    fill: "rgba(30,80,200,0.35)",
    stroke: "rgba(59,130,246,0.9)",
  },
  {
    key: "showPastFlood",
    label: "Historic",
    fill: "rgba(251,146,60,0.30)",
    stroke: "rgba(234,88,12,0.8)",
  },
  {
    key: "showOsmBuildings",
    label: "Buildings",
    fill: "rgba(107,107,214,0.25)",
    stroke: "rgba(107,107,214,0.8)",
  },
];

export default function App() {
  const mapRef = useRef(null);
  const [pointAnalysis, setPointAnalysis] = useState(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [coordError, setCoordError] = useState("");
  const [filters, setFilters] = useState({
    showDsd: true,
    showFlood2025: true,
    showPastFlood: true,
    showOsmBuildings: true,
    basemap: "topo-vector",
  });

  // Bookmarks & History States
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem("flood_bookmarks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("flood_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Automatically track query history
  useEffect(() => {
    if (pointAnalysis && !pointAnalysis.loading && !pointAnalysis.error) {
      setHistory((prev) => {
        // Prevent duplicate adjacent searches by precision
        const filtered = prev.filter(
          (item) =>
            Math.abs(item.lat - pointAnalysis.lat) > 0.0001 ||
            Math.abs(item.lng - pointAnalysis.lng) > 0.0001,
        );
        const updated = [
          {
            id: Date.now().toString(),
            lat: pointAnalysis.lat,
            lng: pointAnalysis.lng,
            date: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...filtered,
        ];
        const sliced = updated.slice(0, 5);
        localStorage.setItem("flood_history", JSON.stringify(sliced));
        return sliced;
      });
    }
  }, [pointAnalysis]);

  const handleSaveBookmark = () => {
    if (!pointAnalysis) return;
    const defaultLabel = `Location (${pointAnalysis.lat.toFixed(4)}, ${pointAnalysis.lng.toFixed(4)})`;
    const label = prompt("Enter a label for this bookmark:", defaultLabel);
    if (label === null) return;
    const finalLabel = label.trim() || defaultLabel;

    setBookmarks((prev) => {
      const updated = [
        ...prev,
        {
          id: Date.now().toString(),
          label: finalLabel,
          lat: pointAnalysis.lat,
          lng: pointAnalysis.lng,
          date: new Date().toLocaleDateString(),
        },
      ];
      localStorage.setItem("flood_bookmarks", JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteBookmark = (id) => {
    setBookmarks((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      localStorage.setItem("flood_bookmarks", JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("flood_history");
  };

  const handleExportReport = () => {
    window.print();
  };

  const handleFilter = (patch) => setFilters((p) => ({ ...p, ...patch }));

  const handleSearch = (e) => {
    e.preventDefault();
    const pLat = parseFloat(lat),
      pLng = parseFloat(lng);
    if (
      isNaN(pLat) ||
      isNaN(pLng) ||
      pLat < -90 ||
      pLat > 90 ||
      pLng < -180 ||
      pLng > 180
    ) {
      setCoordError("Enter valid coordinates");
      return;
    }
    setCoordError("");
    mapRef.current?.goToCoords(pLat, pLng);
  };

  const risk = (() => {
    if (!pointAnalysis || pointAnalysis.loading || pointAnalysis.error)
      return null;
    if (pointAnalysis.flood2025 && pointAnalysis.pastFlood) return RISK.both;
    if (pointAnalysis.flood2025) return RISK.only2025;
    if (pointAnalysis.pastFlood) return RISK.onlyPast;
    return RISK.none;
  })();

  return (
    <>
      {/* ── TOPBAR floats over everything ── */}
      <header className="topbar">
        <div className="topbar-brand">
          {/*<img src="/public/logo.jpeg" alt="FairFirst" className="topbar-logo" />*/}
          {/*<span className="topbar-name">FairFirst</span>*/}
        </div>

        <div className="topbar-spacer" />

        <nav className="topbar-nav">
          <button className="nav-link">Flood Viewer</button>
          <button className="nav-link">Analytics</button>
          <button className="nav-btn">Sign In →</button>
        </nav>
      </header>

      {/* ── SPLIT SHELL ── */}
      <div className="shell">
        {/* LEFT — clipped map */}
        <div className="map-col">
          <Suspense fallback={<MapLoader />}>
            <MapWidget
              ref={mapRef}
              filters={filters}
              onPointAnalysis={setPointAnalysis}
            />
          </Suspense>

          {/* Result popup on map click — lives on the map side */}
          {pointAnalysis && (
            <div className="result-popup">
              <div className="rp-header" style={{ position: "relative" }}>
                <div className="rp-pretitle">Selected Point</div>
                <div className="rp-coords">
                  {pointAnalysis.lat?.toFixed(4)}°N &nbsp;
                  {pointAnalysis.lng?.toFixed(4)}°E
                </div>
                <button
                  className="rp-close"
                  onClick={() => setPointAnalysis(null)}
                >
                  ✕
                </button>
              </div>

              <div className="rp-body">
                {pointAnalysis.loading ? (
                  <div className="rp-loading">
                    <div className="rp-spinner" /> Querying layers…
                  </div>
                ) : pointAnalysis.error ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--coral)",
                      fontWeight: 600,
                    }}
                  >
                    ⚠ Query failed — try again.
                  </div>
                ) : (
                  <>
                    <div className="rp-pills">
                      <div
                        className="rp-pill"
                        style={{
                          background: pointAnalysis.flood2025
                            ? "rgba(216,48,32,0.06)"
                            : "rgba(40,136,53,0.06)",
                          borderColor: pointAnalysis.flood2025
                            ? "rgba(216,48,32,0.2)"
                            : "rgba(40,136,53,0.2)",
                        }}
                      >
                        <span className="rp-pill-label">Flood 2025 (Nov)</span>
                        <span
                          className="rp-pill-val"
                          style={{
                            color: pointAnalysis.flood2025
                              ? "#d83020"
                              : "#288835",
                          }}
                        >
                          {pointAnalysis.flood2025 ? "✓ Affected" : "✗ Clear"}
                        </span>
                      </div>
                      <div
                        className="rp-pill"
                        style={{
                          background: pointAnalysis.pastFlood
                            ? "rgba(216,48,32,0.06)"
                            : "rgba(40,136,53,0.06)",
                          borderColor: pointAnalysis.pastFlood
                            ? "rgba(216,48,32,0.2)"
                            : "rgba(40,136,53,0.2)",
                        }}
                      >
                        <span className="rp-pill-label">
                          Past Events (2016/18)
                        </span>
                        <span
                          className="rp-pill-val"
                          style={{
                            color: pointAnalysis.pastFlood
                              ? "#d83020"
                              : "#288835",
                          }}
                        >
                          {pointAnalysis.pastFlood ? "✓ Affected" : "✗ Clear"}
                        </span>
                      </div>
                    </div>
                    {risk && (
                      <div
                        className="rp-verdict"
                        style={{
                          background: risk.bg,
                          borderColor: risk.border,
                        }}
                      >
                        <span className="rv-emoji">{risk.icon}</span>
                        <div>
                          <div
                            className="rv-label"
                            style={{ color: risk.color }}
                          >
                            {risk.label}
                          </div>
                          <div className="rv-desc">{risk.desc}</div>
                        </div>
                      </div>
                    )}

                    <div className="rp-actions">
                      <button
                        className="rp-action-btn"
                        onClick={handleSaveBookmark}
                        title="Bookmark this location"
                      >
                        <FiBookmark style={{ marginRight: 5 }} /> Bookmark
                      </button>
                      <button
                        className="rp-action-btn print-btn"
                        onClick={handleExportReport}
                        title="Export PDF report"
                      >
                        <FiPrinter style={{ marginRight: 5 }} /> Export Report
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — editorial content */}
        <div className="content-col">
          <div className="hero">
            {/* Live indicator tag */}
            <div className="hero-tag">
              <span className="hero-tag-dot" />
              Sri Lanka · Live Data
            </div>

            {/* Big headline */}
            <h1 className="hero-headline">
              Flood <em>Exposure</em>
            </h1>

            <p className="hero-sub">
              Click anywhere on the map to instantly analyse flood exposure for
              any location in Sri Lanka — 2025 data &amp; historical events.
            </p>

            {/* Search bar as CTA */}
            <div className="search-card">
              <div className="search-card-title">Search by Coordinates</div>
              <form onSubmit={handleSearch}>
                <div className="search-row">
                  <input
                    className="sc-input"
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                  <input
                    className="sc-input"
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                  <button type="submit" className="sc-btn">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    Go
                  </button>
                </div>
                {coordError && <div className="sc-error">{coordError}</div>}
              </form>
            </div>

            {/* Layer chips */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--muted)",
                marginBottom: 10,
              }}
            >
              Map Layers
            </div>
            <div className="layer-chips">
              {LAYERS.map((l) => (
                <button
                  key={l.key}
                  className={`layer-chip ${!filters[l.key] ? "off" : ""}`}
                  onClick={() => handleFilter({ [l.key]: !filters[l.key] })}
                >
                  <div
                    className="chip-swatch"
                    style={{ background: l.fill, borderColor: l.stroke }}
                  />
                  {l.label}
                  {filters[l.key] ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Basemap */}
            <select
              className="bm-select"
              value={filters.basemap}
              onChange={(e) => handleFilter({ basemap: e.target.value })}
            >
              <option value="gray-vector">Light Gray Canvas</option>
              <option value="topo-vector">Topographic</option>
              <option value="streets-navigation-vector">
                Streets Navigation
              </option>
              <option value="hybrid">Hybrid (Satellite + Labels)</option>
              <option value="satellite">Satellite</option>
              <option value="osm">OpenStreetMap</option>
              <option value="dark-gray-vector">Dark Gray Canvas</option>
            </select>

            {/* Stats */}
            <div className="stats-row">
              <div className="stat">
                <span className="stat-num">331</span>
                <span className="stat-lbl">DS Divisions</span>
              </div>
              <div className="stat">
                <span className="stat-num">2025</span>
                <span className="stat-lbl">Latest Data</span>
              </div>
              <div className="stat">
                <span className="stat-num">3×</span>
                <span className="stat-lbl">Flood Events</span>
              </div>
            </div>

            {/* Bookmarks & Recent Searches */}
            <div className="dashboard-grid">
              {/* Bookmarks Section */}
              <div className="dashboard-card">
                <div className="dc-header">
                  <FiBookmark className="dc-icon" />
                  <span className="dc-title">Bookmarks</span>
                </div>
                <div className="dc-body">
                  {bookmarks.length === 0 ? (
                    <div className="dc-empty">No bookmarked locations</div>
                  ) : (
                    <div className="dc-list">
                      {bookmarks.map((b) => (
                        <div key={b.id} className="dc-item">
                          <button
                            className="dc-item-btn"
                            onClick={() =>
                              mapRef.current?.goToCoords(b.lat, b.lng)
                            }
                          >
                            <span className="dc-item-name">{b.label}</span>
                            <span className="dc-item-coords">
                              {b.lat.toFixed(4)}°N, {b.lng.toFixed(4)}°E
                            </span>
                          </button>
                          <button
                            className="dc-item-delete"
                            onClick={() => handleDeleteBookmark(b.id)}
                            title="Delete bookmark"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* History Section */}
              <div className="dashboard-card">
                <div className="dc-header">
                  <FiClock className="dc-icon" />
                  <span className="dc-title">Recent Queries</span>
                </div>
                <div className="dc-body">
                  {history.length === 0 ? (
                    <div className="dc-empty">No recent queries</div>
                  ) : (
                    <div className="dc-list">
                      {history.map((h) => (
                        <div key={h.id} className="dc-item">
                          <button
                            className="dc-item-btn"
                            onClick={() =>
                              mapRef.current?.goToCoords(h.lat, h.lng)
                            }
                          >
                            <span className="dc-item-name">
                              Query at {h.date}
                            </span>
                            <span className="dc-item-coords">
                              {h.lat.toFixed(4)}°N, {h.lng.toFixed(4)}°E
                            </span>
                          </button>
                        </div>
                      ))}
                      <button
                        className="dc-clear-btn"
                        onClick={handleClearHistory}
                      >
                        Clear History
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRINT-ONLY REPORT CONTAINER ── */}
      {pointAnalysis && !pointAnalysis.loading && !pointAnalysis.error && (
        <div className="print-report-container">
          <div className="print-report-header">
            <div className="pr-brand">
              <span className="pr-logo-text">
                FairFirst Flood Exposure Analyzer
              </span>
            </div>
            <div className="pr-meta">
              <div>Report Date: {new Date().toLocaleDateString()}</div>
              <div>Generated Time: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          <h1 className="pr-title">Flood Risk Exposure Analysis Report</h1>
          <p className="pr-intro">
            This official report assesses the historical and current flood risk
            for the location specified by the coordinates below. The assessment
            is based on multisensor satellite observations of the November 2025
            floods and historic records from 2016 and 2018.
          </p>

          <div className="pr-section">
            <h2 className="pr-sec-title">Location Information</h2>
            <table className="pr-table">
              <tbody>
                <tr>
                  <th>Latitude</th>
                  <td>{pointAnalysis.lat?.toFixed(6)}° N</td>
                </tr>
                <tr>
                  <th>Longitude</th>
                  <td>{pointAnalysis.lng?.toFixed(6)}° E</td>
                </tr>
                <tr>
                  <th>Country / Zone</th>
                  <td>Sri Lanka (Western &amp; Southern Basins)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pr-section">
            <h2 className="pr-sec-title">Analysis Verdict</h2>
            <div
              className="pr-verdict-box"
              style={{
                background: risk?.bg || "#fff",
                borderColor: risk?.color || "#ccc",
                borderLeft: `6px solid ${risk?.color || "#ccc"}`,
              }}
            >
              <div
                className="pr-verdict-label"
                style={{
                  color: risk?.color,
                  fontWeight: "bold",
                  fontSize: "14pt",
                  marginBottom: "4px",
                }}
              >
                {risk?.label}
              </div>
              <p
                className="pr-verdict-desc"
                style={{ margin: 0, fontSize: "11pt" }}
              >
                {risk?.desc}
              </p>
            </div>
          </div>

          <div className="pr-section">
            <h2 className="pr-sec-title">Exposure Details Breakdown</h2>
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Flood Period</th>
                  <th>Dataset Observations &amp; Sources</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>November 2025</strong>
                  </td>
                  <td>
                    Multisensor Satellite Observations (Kalani/Maha
                    Oya/Attanagalu Basins)
                  </td>
                  <td
                    style={{
                      color: pointAnalysis.flood2025 ? "#d83020" : "#288835",
                      fontWeight: "bold",
                    }}
                  >
                    {pointAnalysis.flood2025 ? "✓ Affected" : "✗ Clear"}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Past Flood Events</strong>
                  </td>
                  <td>
                    Historical Flood Exposure Records (2016 &amp; 2018 events)
                  </td>
                  <td
                    style={{
                      color: pointAnalysis.pastFlood ? "#d83020" : "#288835",
                      fontWeight: "bold",
                    }}
                  >
                    {pointAnalysis.pastFlood ? "✓ Affected" : "✗ Clear"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pr-footer">
            <p>
              Disclaimer: This analysis is based on available spatial data
              layers. Accuracy depends on remote sensing dataset limits and
              terrain conditions at the recorded times.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
