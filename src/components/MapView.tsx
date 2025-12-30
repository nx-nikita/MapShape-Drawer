/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Marker,
  Tooltip,
  Polygon,
  Rectangle, // kept for future use
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import * as turf from "@turf/turf";
import { Feature, Geometry } from "geojson";

import { hasOverlap } from "../utils/geometry";
import { MAX_SHAPES, ShapeType } from "../config";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "../styles/map.css";


const MapRefSetter = ({
  mapRef,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
}) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};

const CustomZoom = () => {
  const map = useMap();
  useEffect(() => {
    const zoomIn = () => map.zoomIn();
    const zoomOut = () => map.zoomOut();
    window.addEventListener("map-zoom-in", zoomIn);
    window.addEventListener("map-zoom-out", zoomOut);
    return () => {
      window.removeEventListener("map-zoom-in", zoomIn);
      window.removeEventListener("map-zoom-out", zoomOut);
    };
  }, [map]);
  return null;
};

const DrawZoomControl = () => {
  const map = useMap();

  useEffect(() => {
    const ZoomControl = L.Control.extend({
      onAdd: function (): HTMLElement {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar draw-zoom-control"
        );

        const zoomIn = L.DomUtil.create("a", "", container);
        zoomIn.innerHTML = "+";
        zoomIn.title = "Zoom In";

        const zoomOut = L.DomUtil.create("a", "", container);
        zoomOut.innerHTML = "−";
        zoomOut.title = "Zoom Out";

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        L.DomEvent.on(zoomIn, "click", L.DomEvent.stop).on(
          zoomIn,
          "click",
          () => map.zoomIn()
        );
        L.DomEvent.on(zoomOut, "click", L.DomEvent.stop).on(
          zoomOut,
          "click",
          () => map.zoomOut()
        );

        return container;
      },
    });

    const control = new ZoomControl({ position: "topright" }) as L.Control;
    map.addControl(control);

    return () => {
      map.removeControl(control);
    };
  }, [map]);

  return null;
};

const SHAPE_COLORS = [
  { stroke: "#ff6b6b", fill: "#ff8787" },
  { stroke: "#4dabf7", fill: "#74c0fc" },
  { stroke: "#f59f00", fill: "#ffc078" },
  { stroke: "#37b24d", fill: "#8ce99a" },
];

const MapView = () => {
  const [features, setFeatures] = useState<Feature<Geometry>[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchCoords, setSearchCoords] = useState<[number, number] | null>(
    null
  );
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const mapRef = useRef<L.Map | null>(null);

  const onCreated = (e: any) => {
    const layer = e.layer;
    let geojson = layer.toGeoJSON() as Feature<Geometry>;
    const rawType = geojson.geometry.type.toLowerCase();

    if (rawType === "linestring") {
      setFeatures((prev) => [...prev, geojson]);
      return;
    }

    if (layer instanceof L.Circle) {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      geojson = turf.circle([center.lng, center.lat], radius, {
        steps: 64,
        units: "meters",
      }) as Feature<Geometry>;
      geojson.properties = { radius };
    }

    if (hasOverlap(geojson, features)) {
      alert("❌ Shape overlaps existing shape.");
      layer.remove();
      return;
    }

    const color = SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];
    if (layer.setStyle) {
      layer.setStyle({
        color: color.stroke,
        fillColor: color.fill,
        fillOpacity: 0.4,
        weight: 3,
      });
    }

    geojson.properties = {
      ...geojson.properties,
      strokeColor: color.stroke,
      fillColor: color.fill,
    };

    setFeatures((prev) => [...prev, geojson]);
  };

  const onEdited = (e: any) => {
    e.layers.eachLayer((layer: any) => {
      const geojson = layer.toGeoJSON() as Feature<Geometry>;
      setFeatures((prev) =>
        prev.map((f) =>
          f.properties?.id === geojson.properties?.id ? geojson : f
        )
      );
    });
  };

  const onDeleted = (e: any) => {
    e.layers.eachLayer((layer: any) => {
      const geojson = layer.toGeoJSON() as Feature<Geometry>;
      setFeatures((prev) => prev.filter((f) => f !== geojson));
    });
  };

  const handleSearch = async () => {
    if (!searchText) return;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchText
      )}`
    );
    const data = await res.json();
    if (data?.length) {
      const lat = +data[0].lat;
      const lon = +data[0].lon;
      setSearchCoords([lat, lon]);
      mapRef.current?.setView([lat, lon], 9);
    } else {
      alert("Location not found");
    }
  };

  return (
    <div className="map-wrapper">
      <div className="toolbar-wrapper">
        <button
          className="toolbar-toggle"
          onClick={() =>
            document.querySelector(".toolbar-panel")?.classList.toggle("open")
          }
        >
          ☰
        </button>

        <div className="toolbar-panel">
          <div className="rt-title">Map Tools</div>

          <input
            className="rt-search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search place"
          />
          <button className="rt-btn" onClick={handleSearch}>
            🔍
          </button>
          <button
            className="rt-btn export"
            onClick={() => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    { type: "FeatureCollection", features },
                    null,
                    2
                  ),
                ],
                { type: "application/json" }
              );
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "shapes.geojson";
              a.click();
            }}
          >
            ⬇ Export
          </button>

          <div className="rt-divider" />

          <button
            className="rt-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            🌗 Theme
          </button>
        </div>
      </div>

      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        zoomControl={false}
        className="map-container"
      >
        <MapRefSetter mapRef={mapRef} />
        <CustomZoom />

        <TileLayer
          url={
            theme === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />

        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={onCreated}
            onEdited={onEdited}
            onDeleted={onDeleted}
            draw={{
              polygon: true,
              rectangle: true,
              circle: true,
              polyline: true,
              marker: false,
              circlemarker: false,
            }}
          />
        </FeatureGroup>

        <DrawZoomControl />

        {searchCoords && (
          <Marker position={searchCoords}>
            <Tooltip permanent>{searchText}</Tooltip>
          </Marker>
        )}

        {features.map((f, i) => {
          const gType = f.geometry.type.toLowerCase();
          const stroke = f.properties?.strokeColor || "#000";
          const fill = f.properties?.fillColor || "#000";

          if (gType === "polygon")
            return (
              <Polygon
                key={i}
                positions={(f.geometry as any).coordinates[0].map((p: any) => [
                  p[1],
                  p[0],
                ])}
                pathOptions={{
                  color: stroke,
                  fillColor: fill,
                  fillOpacity: 0.4,
                  weight: 3,
                }}
              />
            );

          if (gType === "linestring")
            return (
              <Polyline
                key={i}
                positions={(f.geometry as any).coordinates.map((p: any) => [
                  p[1],
                  p[0],
                ])}
                pathOptions={{ color: stroke, weight: 3 }}
              />
            );

          if (gType === "point" && f.properties?.radius)
            return (
              <Circle
                key={i}
                center={[
                  (f.geometry as any).coordinates[1],
                  (f.geometry as any).coordinates[0],
                ]}
                radius={f.properties.radius}
                pathOptions={{
                  color: stroke,
                  fillColor: fill,
                  fillOpacity: 0.4,
                  weight: 3,
                }}
              />
            );

          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
