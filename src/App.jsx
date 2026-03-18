// File: src/App.jsx
import { useState, useRef } from "react";
import "./index.css";
import MapWidget from "./components/MapWidget";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";

function App() {
  const mapRef = useRef(null);

  const [pointAnalysis, setPointAnalysis] = useState(null);

  const [filters, setFilters] = useState({
    showFlood2025: true,
    showPastFlood: true,
    showOsmBuildings: true,
    basemap: "dark-gray-vector",
  });

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handlePointAnalysis = (data) => {
    setPointAnalysis(data);
  };

  // Called from LeftPanel when user submits coordinates
  const handleCoordSearch = ({ lat, lng }) => {
    if (mapRef.current?.goToCoords) {
      mapRef.current.goToCoords(lat, lng);
    }
  };

  return (
    <div className="app-container">
      <LeftPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onCoordSearch={handleCoordSearch}
      />

      <div className="center-panel">
        <MapWidget
          ref={mapRef}
          filters={filters}
          onPointAnalysis={handlePointAnalysis}
        />
      </div>

      <RightPanel pointAnalysis={pointAnalysis} />
    </div>
  );
}

export default App;
