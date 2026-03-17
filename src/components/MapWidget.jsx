import React, { useEffect, useRef, useState, useCallback } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Sketch from "@arcgis/core/widgets/Sketch";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import "@arcgis/core/assets/esri/themes/dark/main.css";

const FEATURE_LAYER_URL =
  "https://services1.arcgis.com/tMAq108b7itjkui5/ArcGIS/rest/services/Buildings_damages_2025_flood_kelani_river/FeatureServer/0";

const FLOOD_EXTENT_URL =
  "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/Flood_Layer_Ex_SmoothPolygon/FeatureServer/0";

// Country-wide Sri Lanka Flood Extent (Multisensor, Nov 2025)
const SL_FLOOD_EXTENT_URL =
  "https://services1.arcgis.com/tMAq108b7itjkui5/arcgis/rest/services/Multisensors_20251126_20251202_FloodExtent_SriLanka/FeatureServer/1";

// OSM Asia Buildings layer
const OSM_BUILDINGS_URL =
  "https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AS_Buildings/FeatureServer/0";

const MapWidget = ({
  filters,
  onFeatureSelect,
  onStatsUpdate,
  onLayerViewReady,
}) => {
  const mapDiv = useRef(null);
  const layerViewRef = useRef(null);
  const viewRef = useRef(null);
  const featureLayerRef = useRef(null);
  const sketchGeometryRef = useRef(null);

  // Draggable legend state
  const [legendPos, setLegendPos] = useState({ x: 16, y: 16 });
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const dragStart = useRef(null);

  const onLegendMouseDown = useCallback((e) => {
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
  }, [legendPos]);

  // Initialize Map
  useEffect(() => {
    if (mapDiv.current) {
      // Create GraphicsLayer for Sketch
      const sketchLayer = new GraphicsLayer();

      // Create FeatureLayer
      const featureLayer = new FeatureLayer({
        url: FEATURE_LAYER_URL,
        outFields: ["*"],
        popupEnabled: false, // We handle selection manually in RightPanel
      });
      // Create Flood Extent Layer
      const floodExtentLayer = new FeatureLayer({
        url: FLOOD_EXTENT_URL,
        outFields: ["*"],
        popupEnabled: false,
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [59, 130, 246, 0.3], // semi-transparent blue
            outline: {
              color: [59, 130, 246, 0.8],
              width: 1,
            },
          },
        },
      });
      // Country-wide Sri Lanka Flood Extent layer (Multisensor Nov 2025)
      const srilankaFloodLayer = new FeatureLayer({
        url: SL_FLOOD_EXTENT_URL,
        outFields: ["*"],
        popupEnabled: false,
        title: "Flood Extent – Sri Lanka (Nov 2025)",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [30, 80, 200, 0.35], // deep blue, semi-transparent
            outline: {
              color: [30, 80, 200, 0.8],
              width: 1.2,
            },
          },
        },
      });

      // OSM Asia Buildings layer (visible at zoom >= ~14)
      const osmBuildingsLayer = new FeatureLayer({
        url: OSM_BUILDINGS_URL,
        outFields: ["name", "building", "addr_city", "addr_street", "addr_housenumber", "height", "building_levels"],
        popupEnabled: false,
        title: "OSM Buildings",
        minScale: 9475, // Only render when zoomed in (matches service constraint)
        // Use the service's own renderer (unique value by building type)
      });

      // We attach it to the view/map so we can toggle visibility later
      featureLayerRef.current = {
        buildings: featureLayer,
        floodExtent: floodExtentLayer,
        srilankaFlood: srilankaFloodLayer,
        osmBuildings: osmBuildingsLayer,
      };

      // Create Map — country flood at the bottom, OSM buildings above flood layers, damage buildings on top
      const map = new Map({
        basemap: "dark-gray-vector",
        layers: [srilankaFloodLayer, osmBuildingsLayer, floodExtentLayer, featureLayer, sketchLayer],
      });

      // Create MapView
      const view = new MapView({
        container: mapDiv.current,
        map: map,
        center: [79.9, 6.95], // Rough coordinates for Kelaniya area roughly
        zoom: 13,
        padding: {
          left: 320, // To avoid being under the left panel
          right: 360, // To avoid being under the right panel
        },
        ui: {
          components: ["zoom", "compass"],
        },
      });
      viewRef.current = view;

      // Wait for view to be ready
      view.when(() => {
        // Add Sketch widget
        const sketch = new Sketch({
          layer: sketchLayer,
          view: view,
          creationMode: "update",
          availableCreateTools: ["polygon", "rectangle"],
        });
        view.ui.add(sketch, "top-right");

        // Handle Sketch Events
        sketch.on("create", (event) => {
          if (event.state === "complete") {
            sketchGeometryRef.current = event.graphic.geometry;
            updateStats();
          }
        });

        sketch.on("update", (event) => {
          if (event.state === "complete" || event.state === "active") {
            if (event.graphics.length > 0) {
              sketchGeometryRef.current = event.graphics[0].geometry;
              updateStats();
            }
          }
        });

        sketch.on("delete", () => {
          sketchGeometryRef.current = null;
          updateStats();
        });

        // Get layer view and setup events
        view.whenLayerView(featureLayer).then((layerView) => {
          layerViewRef.current = layerView;
          if (onLayerViewReady) onLayerViewReady(layerView);

          // Initial stats calculation when layer view finishes updating
          reactiveUtils.when(
            () => !layerView.updating,
            () => {
              updateStats();
            },
            { once: true },
          );

          // Update stats on extent change
          reactiveUtils.watch(
            () => view.extent,
            () => {
              if (!layerView.updating) {
                updateStats();
              }
            },
          );
        });

        // Click handler to select feature
        view.on("click", async (event) => {
          const response = await view.hitTest(event);
          const results = response.results.filter(
            (result) => result.graphic.layer === featureLayer,
          );

          if (results.length > 0) {
            const buildingGraphic = results[0].graphic;
            const attributes = { ...buildingGraphic.attributes };

            // Perform Spatial Query against the Flood Extent layer
            try {
              const query = floodExtentLayer.createQuery();
              query.geometry = buildingGraphic.geometry;
              query.spatialRelationship = "intersects";
              query.returnGeometry = false;
              query.outFields = ["OBJECTID"]; // Just need to know if it hits

              const intersectResult =
                await floodExtentLayer.queryFeatures(query);
              if (intersectResult.features.length > 0) {
                attributes.floodExposure = "Inside Flood Area";
              } else {
                attributes.floodExposure = "Outside Flood Area";
              }
            } catch (err) {
              console.error("Spatial query failed: ", err);
              attributes.floodExposure = "Unknown";
            }

            onFeatureSelect(attributes);
          } else {
            onFeatureSelect(null);
          }
        });
      });

      return () => {
        if (view) {
          view.destroy();
        }
      };
    }
  }, []);

  // Update Stats from LayerView
  const updateStats = async () => {
    if (!layerViewRef.current || !featureLayerRef.current?.buildings) return;

    try {
      const query = featureLayerRef.current.buildings.createQuery();

      // Filter by current geometry if drawn
      if (sketchGeometryRef.current) {
        query.geometry = sketchGeometryRef.current;
        query.spatialRelationship = "intersects";
      } else {
        query.geometry = viewRef.current.extent;
      }

      // Add where clause based on active filters
      const filterClauses = getFilterWhereClause(filters);
      if (filterClauses) {
        query.where = filterClauses;
      } else {
        query.where = "1=1";
      }

      // Instead of full queries, we can query feature count or raw attributes
      // Getting specific fields is faster than full geometries
      query.outFields = ["gridcode"];
      query.returnGeometry = false;

      const results = await layerViewRef.current.queryFeatures(query);
      const features = results.features;

      let total = features.length;
      let affected = 0;
      let severe = 0;
      let moderate = 0;
      let minor = 0;

      features.forEach((f) => {
        const attr = f.attributes;

        if (attr.gridcode === 2) {
          affected++;
          severe++; // We classify all damaged buildings as severe since only binary data exists
        }
      });

      onStatsUpdate({
        total,
        affected,
        severe,
        moderate,
        minor,
      });
    } catch (e) {
      console.error("Error updating stats", e);
    }
  };

  // Convert UI filters to ArcGIS Where Clause
  const getFilterWhereClause = (currentFilters) => {
    const clauses = [];

    // Exact column names might vary, so we handle possible variations with OR / standard fields later
    // if we know the precise API fields we can refine this.

    if (currentFilters.damageLevel && currentFilters.damageLevel !== "all") {
      const lvl = currentFilters.damageLevel;
      if (lvl === "severe") clauses.push("gridcode = 2");
      if (lvl === "moderate" || lvl === "minor") clauses.push("1=0");
      if (lvl === "none") clauses.push("gridcode IS NULL");
    }

    if (currentFilters.floodStatus && currentFilters.floodStatus !== "all") {
      if (currentFilters.floodStatus === "affected") {
        clauses.push("gridcode = 2");
      } else {
        clauses.push("gridcode IS NULL");
      }
    }

    if (currentFilters.searchId) {
      // Just a basic wildcard search by Object ID
      clauses.push(`(OBJECTID = ${Number(currentFilters.searchId) || -1})`);
    }

    return clauses.length > 0 ? clauses.join(" AND ") : null;
  };

  // Apply visual filters when filters prop changes
  useEffect(() => {
    if (layerViewRef.current && featureLayerRef.current?.buildings) {
      const where = getFilterWhereClause(filters);
      layerViewRef.current.filter = {
        where: where || "1=1",
      };

      // Handle flood layer visibility toggles
      if (featureLayerRef.current.floodExtent) {
        featureLayerRef.current.floodExtent.visible =
          filters.showFloodExtent !== false;
      }
      if (featureLayerRef.current.srilankaFlood) {
        featureLayerRef.current.srilankaFlood.visible =
          filters.showSrilankaFlood !== false;
      }
      if (featureLayerRef.current.osmBuildings) {
        featureLayerRef.current.osmBuildings.visible =
          filters.showOsmBuildings !== false;
      }

      // Also update stats when filters change
      updateStats();

      // If searchId is precise and matches, zoom to it
      if (filters.searchId && viewRef.current) {
        const query = featureLayerRef.current.buildings.createQuery();
        query.where = getFilterWhereClause({ searchId: filters.searchId });
        query.returnGeometry = true;

        featureLayerRef.current.buildings
          .queryFeatures(query)
          .then((results) => {
            if (results.features.length > 0) {
              viewRef.current.goTo({
                target: results.features[0],
                zoom: 18,
              });

              // We can't automatically run spatial query here without duplicating logic easily,
              // so we'll just pass the base attributes for now on search zoom.
              onFeatureSelect(results.features[0].attributes);
            }
          });
      }
    }
  }, [filters]);

  // Legend items definition
  const legendItems = [
    {
      title: "Flood Damages 2025",
      items: [
        { label: "No Damage", color: "rgba(234,208,4,0.85)", border: "#b8960a" },
        { label: "Damaged", color: "rgba(220,38,38,0.85)", border: "#991b1b" },
      ],
    },
    {
      title: "Flood Extent (Kelani)",
      items: [
        { label: "Flood area", color: "rgba(59,130,246,0.30)", border: "rgba(59,130,246,0.8)" },
      ],
    },
    {
      title: "Flood Extent – Sri Lanka",
      items: [
        { label: "Flood polygons", color: "rgba(30,80,200,0.35)", border: "rgba(30,80,200,0.8)" },
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
  ];

  return (
    <div
      className="map-view"
      ref={mapDiv}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {/* Draggable Legend Panel */}
      <div
        style={{
          position: "absolute",
          left: legendPos.x,
          top: legendPos.y,
          zIndex: 10,
          background: "rgba(15,23,42,0.88)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          minWidth: "190px",
          maxWidth: "230px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          userSelect: "none",
          fontSize: "12px",
          color: "#e2e8f0",
        }}
      >
        {/* Drag handle / header */}
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
            style={{
              background: "transparent",
              border: "none",
              color: "#93c5fd",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
              padding: "0 2px",
            }}
            title={legendCollapsed ? "Expand" : "Collapse"}
          >
            {legendCollapsed ? "▲" : "▼"}
          </button>
        </div>

        {/* Legend body */}
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
                      width: "18px",
                      height: "12px",
                      borderRadius: "3px",
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
};

export default MapWidget;
