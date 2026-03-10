import React, { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Legend from "@arcgis/core/widgets/Legend";
import Sketch from "@arcgis/core/widgets/Sketch";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import "@arcgis/core/assets/esri/themes/dark/main.css";

const FEATURE_LAYER_URL =
  "https://services1.arcgis.com/tMAq108b7itjkui5/ArcGIS/rest/services/Buildings_damages_2025_flood_kelani_river/FeatureServer/0";

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
      featureLayerRef.current = featureLayer;

      // Create Map
      const map = new Map({
        basemap: "dark-gray-vector",
        layers: [featureLayer, sketchLayer],
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
        // Add Legend
        const legend = new Legend({
          view: view,
          layerInfos: [{ layer: featureLayer, title: "Flood Damages 2025" }],
        });
        view.ui.add(legend, "bottom-left");

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
        view.on("click", (event) => {
          view.hitTest(event).then((response) => {
            const results = response.results.filter(
              (result) => result.graphic.layer === featureLayer,
            );

            if (results.length > 0) {
              const graphic = results[0].graphic;
              onFeatureSelect(graphic.attributes);
            } else {
              onFeatureSelect(null);
            }
          });
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
    if (!layerViewRef.current || !featureLayerRef.current) return;

    try {
      const query = featureLayerRef.current.createQuery();

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
    if (layerViewRef.current && featureLayerRef.current) {
      const where = getFilterWhereClause(filters);
      layerViewRef.current.filter = {
        where: where || "1=1",
      };

      // Also update stats when filters change
      updateStats();

      // If searchId is precise and matches, zoom to it
      if (filters.searchId && viewRef.current) {
        const query = featureLayerRef.current.createQuery();
        query.where = getFilterWhereClause({ searchId: filters.searchId });
        query.returnGeometry = true;

        featureLayerRef.current.queryFeatures(query).then((results) => {
          if (results.features.length > 0) {
            viewRef.current.goTo({
              target: results.features[0],
              zoom: 18,
            });
            onFeatureSelect(results.features[0].attributes);
          }
        });
      }
    }
  }, [filters]);

  return (
    <div
      className="map-view"
      ref={mapDiv}
      style={{ width: "100%", height: "100%" }}
    ></div>
  );
};

export default MapWidget;
