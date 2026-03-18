// File: src/components/MapWidget.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import "@arcgis/core/assets/esri/themes/dark/main.css";

// 2025 Multisensor Flood Extent – Sri Lanka
const SL_FLOOD_2025_URL =
  "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/Multisensors_20251126_20251202_FloodExtent_SriLanka/FeatureServer/1";

// Past Flood Events 2016/2018
const PAST_FLOOD_URL =
  "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/Pastfood_AllLayers/FeatureServer/15";

// OSM Asia Buildings
const OSM_BUILDINGS_URL =
  "https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AS_Buildings/FeatureServer/0";

const PIN_SYMBOL = {
  type: "simple-marker",
  style: "circle",
  color: [255, 255, 255, 1],
  size: "12px",
  outline: { color: [239, 68, 68, 1], width: 3 },
};

const MapWidget = forwardRef(({ filters, onPointAnalysis }, ref) => {
  const mapDiv = useRef(null);
  const viewRef = useRef(null);
  const layerRef = useRef({});
  const pinLayerRef = useRef(null);

  // Draggable legend state
  const [legendPos, setLegendPos] = useState({ x: 16, y: 16 });
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const dragStart = useRef(null);

  const onLegendMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: legendPos.x,
        oy: legendPos.y,
      };
      const onMove = (ev) => {
        const dx = ev.clientX - dragStart.current.mx;
        const dy = ev.clientY - dragStart.current.my;
        setLegendPos({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [legendPos]
  );

  // Expose goToCoords for parent (coordinate search)
  useImperativeHandle(ref, () => ({
    goToCoords: (lat, lng) => {
      if (viewRef.current) {
        viewRef.current.goTo({ center: [lng, lat], zoom: 14 });
        dropPinAndQuery(lng, lat);
      }
    },
  }));

  // Drop pin + run flood queries at a given WGS84 lng/lat
  const dropPinAndQuery = useCallback(async (lng, lat) => {
    const pinLayer = pinLayerRef.current;
    if (!pinLayer) return;

    // Clear old pin
    pinLayer.removeAll();

    const point = new Point({ longitude: lng, latitude: lat, spatialReference: { wkid: 4326 } });

    // Drop pin graphic
    pinLayer.add(
      new Graphic({
        geometry: point,
        symbol: PIN_SYMBOL,
      })
    );

    // Notify parent: loading
    onPointAnalysis({ lat, lng, loading: true });

    try {
      const flood2025Layer = layerRef.current.flood2025;
      const pastFloodLayer = layerRef.current.pastFlood;

      const makeQuery = (layer) => {
        const q = layer.createQuery();
        q.geometry = point;
        q.spatialRelationship = "intersects";
        // Optimized: just get the count instead of full geometries/attributes
        return layer.queryFeatureCount(q);
      };

      const [count2025, countPast] = await Promise.all([
        makeQuery(flood2025Layer),
        makeQuery(pastFloodLayer),
      ]);

      onPointAnalysis({
        lat,
        lng,
        loading: false,
        flood2025: count2025 > 0,
        pastFlood: countPast > 0,
        pastFloodAttrs: [],
      });
    } catch (err) {
      console.error("Flood query failed:", err);
      onPointAnalysis({ lat, lng, loading: false, error: true });
    }
  }, [onPointAnalysis]);

  // Initialize Map
  useEffect(() => {
    if (!mapDiv.current) return;

    // Pin graphics layer
    const pinLayer = new GraphicsLayer({ listMode: "hide" });
    pinLayerRef.current = pinLayer;

    // 2025 Flood Extent layer
    const flood2025Layer = new FeatureLayer({
      url: SL_FLOOD_2025_URL,
      outFields: [], // Optimized: only fetch what the renderer needs
      popupEnabled: false,
      title: "Flood Extent 2025",
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [30, 80, 200, 0.38],
          outline: { color: [59, 130, 246, 0.85], width: 1.2 },
        },
      },
    });

    // Past Flood Events layer (2016/2018)
    const pastFloodLayer = new FeatureLayer({
      url: PAST_FLOOD_URL,
      outFields: [], // Optimized
      popupEnabled: false,
      title: "Past Flood Events (2016/2018)",
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [251, 146, 60, 0.32],
          outline: { color: [234, 88, 12, 0.8], width: 1 },
        },
      },
    });

    // OSM Buildings
    const osmBuildingsLayer = new FeatureLayer({
      url: OSM_BUILDINGS_URL,
      outFields: [], // Optimized: API automatically includes 'building' for rendering
      popupEnabled: false,
      title: "OSM Buildings",
      minScale: 9475,
    });

    layerRef.current = {
      flood2025: flood2025Layer,
      pastFlood: pastFloodLayer,
      osmBuildings: osmBuildingsLayer,
    };

    const map = new Map({
      basemap: "dark-gray-vector",
      // Past flood at bottom, 2025 flood on top, OSM buildings above both, pin on top
      layers: [pastFloodLayer, flood2025Layer, osmBuildingsLayer, pinLayer],
    });

    const view = new MapView({
      container: mapDiv.current,
      map,
      center: [80.7, 7.8], // Sri Lanka centre
      zoom: 8,
      padding: { left: 320, right: 360 },
      ui: { components: ["zoom", "compass"] },
    });
    viewRef.current = view;

    // Click handler: drop pin + query
    view.when(() => {
      view.on("click", (event) => {
        const { longitude, latitude } = event.mapPoint;
        dropPinAndQuery(longitude, latitude);
      });
    });

    return () => view.destroy();
  }, []);

  // Layer visibility toggles
  useEffect(() => {
    const { flood2025, pastFlood, osmBuildings } = layerRef.current;
    if (!flood2025) return;
    flood2025.visible = filters.showFlood2025 !== false;
    pastFlood.visible = filters.showPastFlood !== false;
    osmBuildings.visible = filters.showOsmBuildings !== false;
  }, [filters]);

  // Basemap switcher
  useEffect(() => {
    if (viewRef.current && filters.basemap) {
      viewRef.current.map.basemap = filters.basemap;
    }
  }, [filters.basemap]);

  // Legend definition
  const legendItems = [
    {
      title: "Flood Extent 2025 (Nov)",
      items: [
        { label: "Flood area", color: "rgba(30,80,200,0.38)", border: "rgba(59,130,246,0.85)" },
      ],
    },
    {
      title: "Past Flood Events (2016/2018)",
      items: [
        { label: "Flood area", color: "rgba(251,146,60,0.32)", border: "rgba(234,88,12,0.8)" },
      ],
    },
    {
      title: "OSM Buildings",
      items: [
        { label: "house",       color: "rgb(237,81,81)",   border: "#999" },
        { label: "residential", color: "rgb(20,158,206)",  border: "#999" },
        { label: "school",      color: "rgb(167,198,54)",  border: "#999" },
        { label: "hospital",    color: "rgb(183,129,74)",  border: "#999" },
        { label: "public",      color: "rgb(107,107,214)", border: "#999" },
        { label: "other",       color: "rgb(170,170,170)", border: "#999" },
      ],
    },
    {
      title: "Pin",
      items: [
        { label: "Selected point", color: "#fff", border: "rgb(239,68,68)", circle: true },
      ],
    },
  ];

  return (
    <div
      className="map-view"
      ref={mapDiv}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {/* Draggable Legend */}
      <div
        style={{
          position: "absolute",
          left: legendPos.x,
          top: legendPos.y,
          zIndex: 10,
          background: "rgba(15,23,42,0.90)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "10px",
          minWidth: "190px",
          maxWidth: "230px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          userSelect: "none",
          fontSize: "12px",
          color: "#e2e8f0",
        }}
      >
        <div
          onMouseDown={onLegendMouseDown}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            cursor: "grab",
            borderBottom: legendCollapsed ? "none" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: legendCollapsed ? "10px" : "10px 10px 0 0",
            background: "rgba(59,130,246,0.15)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase", color: "#93c5fd" }}>
            ⋮⋮ Legend
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setLegendCollapsed((c) => !c)}
            style={{ background: "transparent", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 2px" }}
            title={legendCollapsed ? "Expand" : "Collapse"}
          >
            {legendCollapsed ? "▲" : "▼"}
          </button>
        </div>

        {!legendCollapsed && (
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {legendItems.map((group) => (
              <div key={group.title}>
                <div style={{ fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: "5px" }}>
                  {group.title}
                </div>
                {group.items.map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                    <div style={{
                      width: item.circle ? "12px" : "18px",
                      height: "12px",
                      borderRadius: item.circle ? "50%" : "3px",
                      background: item.color,
                      border: `1.5px solid ${item.border}`,
                      flexShrink: 0,
                    }} />
                    <span style={{ color: "#cbd5e1", fontSize: "11px" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MapWidget;
