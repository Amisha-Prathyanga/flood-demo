// File: src/components/MapWidget.jsx
import React, {
  useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef,
} from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import ScaleBar from "@arcgis/core/widgets/ScaleBar";
import Legend from "@arcgis/core/widgets/Legend";
import Expand from "@arcgis/core/widgets/Expand";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import "@arcgis/core/assets/esri/themes/light/main.css";

const DSD_URL = "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/SL_DSD_codes/FeatureServer/0";
const SL_FLOOD_2025_URL = "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/Multisensors_20251126_20251202_FloodExtent_SriLanka_moya/FeatureServer/31";
const PAST_FLOOD_URL = "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/Past_flood_events/FeatureServer/34";
const OSM_BUILDINGS_URL = "https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AS_Buildings/FeatureServer/0";

const SL_EXTENT = new Extent({
  xmin: 79.652, ymin: 5.917,
  xmax: 81.879, ymax: 9.835,
  spatialReference: { wkid: 4326 },
});

const PIN_SYMBOL = {
  type: "simple-marker", style: "circle",
  color: [255, 255, 255, 1], size: "13px",
  outline: { color: [40, 79, 161, 1], width: 3 },
};

const LEGEND_GROUPS = [
  { title: "DSD Boundaries", items: [{ label: "DS Division", fill: "rgba(173,216,230,0.15)", stroke: "rgba(60,100,160,0.85)" }] },
  { title: "Flood 2025", items: [{ label: "Flood area", fill: "rgba(30,80,200,0.35)", stroke: "rgba(59,130,246,0.9)" }] },
  { title: "Past Flood Events", items: [{ label: "Flood area", fill: "rgba(251,146,60,0.30)", stroke: "rgba(234,88,12,0.8)" }] },
  {
    title: "Buildings",
    items: [
      { label: "house", fill: "rgb(237,81,81)", stroke: "#bbb" },
      { label: "residential", fill: "rgb(20,158,206)", stroke: "#bbb" },
      { label: "school", fill: "rgb(167,198,54)", stroke: "#bbb" },
      { label: "hospital", fill: "rgb(183,129,74)", stroke: "#bbb" },
      { label: "other", fill: "rgb(200,200,200)", stroke: "#bbb" },
    ],
  },
  { title: "Pin", items: [{ label: "Selected point", fill: "#fff", stroke: "rgb(40,79,161)", circle: true }] },
];

const MapWidget = forwardRef(({ filters, onPointAnalysis }, ref) => {
  const mapDiv = useRef(null);
  const viewRef = useRef(null);
  const layerRef = useRef({});
  const pinLayerRef = useRef(null);
  const [legendPos, setLegendPos] = useState({ top: 200, left: 15 });
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const dragging = useRef(null);

  const onLegendMouseDown = useCallback((e) => {
    e.preventDefault();
    const el = e.currentTarget.closest(".map-legend");
    const rect = el.getBoundingClientRect();
    const parent = el.parentElement.getBoundingClientRect();
    dragging.current = {
      mx: e.clientX, my: e.clientY,
      ox: rect.left - parent.left,
      oy: rect.top - parent.top,
    };
    const onMove = (ev) => {
      const dx = ev.clientX - dragging.current.mx;
      const dy = ev.clientY - dragging.current.my;
      setLegendPos({ left: dragging.current.ox + dx, top: dragging.current.oy + dy, right: "auto", bottom: "auto" });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const dropPinAndQuery = useCallback(async (lng, lat) => {
    const pinLayer = pinLayerRef.current;
    if (!pinLayer) return;
    pinLayer.removeAll();
    const point = new Point({ longitude: lng, latitude: lat, spatialReference: { wkid: 4326 } });
    pinLayer.add(new Graphic({ geometry: point, symbol: PIN_SYMBOL }));
    onPointAnalysis({ lat, lng, loading: true });
    try {
      const makeQ = (layer) => {
        const q = layer.createQuery();
        q.geometry = point; q.spatialRelationship = "intersects";
        return layer.queryFeatureCount(q);
      };
      const [c2025, cPast] = await Promise.all([
        makeQ(layerRef.current.flood2025),
        makeQ(layerRef.current.pastFlood),
      ]);
      onPointAnalysis({ lat, lng, loading: false, flood2025: c2025 > 0, pastFlood: cPast > 0 });
    } catch (err) {
      console.error(err);
      onPointAnalysis({ lat, lng, loading: false, error: true });
    }
  }, [onPointAnalysis]);

  useImperativeHandle(ref, () => ({
    goToCoords: (lat, lng) => {
      if (viewRef.current) {
        viewRef.current.goTo({ center: [lng, lat], zoom: 14 });
        dropPinAndQuery(lng, lat);
      }
    },
  }));

  useEffect(() => {
    if (!mapDiv.current) return;

    const pinLayer = new GraphicsLayer({ listMode: "hide" });
    pinLayerRef.current = pinLayer;

    const dsdLayer = new FeatureLayer({
      url: DSD_URL, title: "DSD Boundaries",
      popupEnabled: false, opacity: 0.5,
      renderer: { type: "simple", symbol: { type: "simple-fill", color: [173, 216, 230, 0], outline: { color: [60, 100, 160, 0.85], width: 1 } } },
    });
    const flood2025Layer = new FeatureLayer({
      url: SL_FLOOD_2025_URL, title: "Flood Extent 2025",
      outFields: [], popupEnabled: false,
      renderer: { type: "simple", symbol: { type: "simple-fill", color: [30, 80, 200, 0.35], outline: { color: [59, 130, 246, 0.9], width: 1.2 } } },
    });
    const pastFloodLayer = new FeatureLayer({
      url: PAST_FLOOD_URL, title: "Past Flood Events (2016/2018)",
      outFields: [], popupEnabled: false,
      renderer: { type: "simple", symbol: { type: "simple-fill", color: [251, 146, 60, 0.30], outline: { color: [234, 88, 12, 0.8], width: 1 } } },
    });
    const osmBuildingsLayer = new FeatureLayer({
      url: OSM_BUILDINGS_URL, title: "OSM Buildings",
      outFields: [], popupEnabled: false, minScale: 9475,
    });

    layerRef.current = { dsd: dsdLayer, flood2025: flood2025Layer, pastFlood: pastFloodLayer, osmBuildings: osmBuildingsLayer };

    const map = new Map({
      basemap: filters.basemap || "topo-vector",
      layers: [dsdLayer, pastFloodLayer, flood2025Layer, osmBuildingsLayer, pinLayer],
    });

    const view = new MapView({
      container: mapDiv.current, map,
      extent: SL_EXTENT,
      ui: { components: ["zoom", "compass"] },
    });
    view.ui.padding = { top: 70, left: 15, right: 15, bottom: 15 };
    viewRef.current = view;

    view.when(() => {
      view.on("click", e => dropPinAndQuery(e.mapPoint.longitude, e.mapPoint.latitude));

      // ScaleBar
      view.ui.add(new ScaleBar({ view, unit: "metric", style: "line" }), "bottom-left");

      // Basemap gallery expand
      view.ui.add(new Expand({
        view, content: new BasemapGallery({ view }),
        expandIcon: "basemap", expandTooltip: "Basemap Gallery", expanded: false,
      }), "top-left");
    });

    return () => view.destroy();
  }, []); // eslint-disable-line

  useEffect(() => {
    const { dsd, flood2025, pastFlood, osmBuildings } = layerRef.current;
    if (!flood2025) return;
    if (dsd) dsd.visible = filters.showDsd !== false;
    flood2025.visible = filters.showFlood2025 !== false;
    pastFlood.visible = filters.showPastFlood !== false;
    osmBuildings.visible = filters.showOsmBuildings !== false;
  }, [filters]);

  useEffect(() => {
    if (viewRef.current?.map && filters.basemap) {
      viewRef.current.map.basemap = filters.basemap;
    }
  }, [filters.basemap]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />

      {/* Custom floating legend */}
      <div className="map-legend" style={legendPos}>
        <div className="lg-header" onMouseDown={onLegendMouseDown}>
          <span className="lg-title">⠿ Legend</span>
          <button className="lg-toggle" onMouseDown={e => e.stopPropagation()} onClick={() => setLegendCollapsed(c => !c)}>
            {legendCollapsed ? "▲" : "▼"}
          </button>
        </div>
        {!legendCollapsed && (
          <div className="lg-body">
            {LEGEND_GROUPS.map(g => (
              <div key={g.title}>
                <div className="lg-group-title">{g.title}</div>
                {g.items.map(item => (
                  <div key={item.label} className="lg-row">
                    {item.circle
                      ? <div className="lg-circle" style={{ background: item.fill, borderColor: item.stroke }} />
                      : <div className="lg-swatch" style={{ background: item.fill, borderColor: item.stroke }} />}
                    <span className="lg-lbl">{item.label}</span>
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