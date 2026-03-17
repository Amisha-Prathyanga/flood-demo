import { useState, useRef } from "react";
import "./index.css";
import MapWidget from "./components/MapWidget";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";

function App() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [filters, setFilters] = useState({
    damageLevel: "all",
    floodStatus: "all",
    searchId: "",
    showFloodExtent: true,
    showSrilankaFlood: true,
    showOsmBuildings: true,
  });

  // This will store stats generated from the layer view
  const [stats, setStats] = useState({
    total: 0,
    affected: 0,
    severe: 0,
    moderate: 0,
    minor: 0,
  });

  const layerViewRef = useRef(null);

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleFeatureSelect = (attributes) => {
    setSelectedFeature(attributes);
  };

  const handleStatsUpdate = (newStats) => {
    setStats(newStats);
  };

  return (
    <div className="app-container">
      <LeftPanel filters={filters} onFilterChange={handleFilterChange} />

      <div className="center-panel">
        <MapWidget
          filters={filters}
          onFeatureSelect={handleFeatureSelect}
          onStatsUpdate={handleStatsUpdate}
          onLayerViewReady={(layerView) => {
            layerViewRef.current = layerView;
          }}
        />
      </div>

      <RightPanel selectedFeature={selectedFeature} stats={stats} />
    </div>
  );
}

export default App;
