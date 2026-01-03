import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Marker,
  Tooltip,
  Polygon,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import * as turf from "@turf/turf";
import { Feature, Geometry, Polygon as GeoPolygon, FeatureCollection } from "geojson";

import { trimPolygon } from "../utils/geometry";
import { MAX_SHAPES, ShapeType } from "../config";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "../styles/map.css";

const MapRefSetter = ({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};
// ✅ Simple user-friendly error function
const showError = (msg: string) => {
  alert(msg); // abhi simple alert, future me toast bhi laga sakte hain
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
        const container = L.DomUtil.create("div", "leaflet-bar draw-zoom-control");

        const zoomIn = L.DomUtil.create("a", "", container);
        zoomIn.innerHTML = "+";

        const zoomOut = L.DomUtil.create("a", "", container);
        zoomOut.innerHTML = "−";

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        L.DomEvent.on(zoomIn, "click", () => map.zoomIn());
        L.DomEvent.on(zoomOut, "click", () => map.zoomOut());

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
  const [searchCoords, setSearchCoords] = useState<[number, number] | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const mapRef = useRef<L.Map | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup | null>(null); // ✅ FeatureGroup ref

  // ✅ GeoJSON Export Function with type assertion
  const exportGeoJSON = () => {
    if (!featureGroupRef.current) return;

    const geoJson = featureGroupRef.current.toGeoJSON() as FeatureCollection<Geometry>;

    // Add shapeType to each feature
    geoJson.features = geoJson.features.map(f => ({
      ...f,
      properties: {
        ...f.properties,
        shapeType: f.geometry.type,
      },
    }));

    // Download file
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shapes.geojson";
    a.click();
  };

  const onCreated = (e: any) => {
    const layer = e.layer;
    let geojson = layer.toGeoJSON() as Feature<Geometry>;
    const rawType = geojson.geometry.type.toLowerCase();

    let shapeType: ShapeType;
    if (rawType === "linestring") shapeType = "linestring";
    else if (layer instanceof L.Circle) shapeType = "circle";
    else if (layer instanceof L.Rectangle) shapeType = "rectangle";
    else shapeType = "polygon";

    const currentCount = features.filter(f => f.properties?.shapeType === shapeType).length;
    if (currentCount >= MAX_SHAPES[shapeType]) {
      alert(`❌ Maximum ${shapeType} limit reached`);
      layer.remove();
      return;
    }

    if (shapeType === "linestring") {
      geojson.properties = { shapeType, id: Date.now() };
      setFeatures(prev => [...prev, geojson]);
      return;
    }

    let polygonFeature: Feature<GeoPolygon>;
    if (layer instanceof L.Circle) {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      polygonFeature = turf.circle([center.lng, center.lat], radius, {
        steps: 64,
        units: "meters",
      }) as Feature<GeoPolygon>;
    } else if (layer instanceof L.Rectangle) {
      polygonFeature = layer.toGeoJSON() as Feature<GeoPolygon>;
    } else {
      polygonFeature = geojson as Feature<GeoPolygon>;
    }

    const polygonFeatures = features.filter(f => f.geometry.type === "Polygon") as Feature<GeoPolygon>[];
    let finalPolygon = polygonFeature;

    for (const existing of polygonFeatures) {
      if (turf.booleanContains(existing, finalPolygon) || turf.booleanContains(finalPolygon, existing)) {
        showError("❌ Polygon fully overlaps existing shape");
        layer.remove();
        return;
      }
      if (turf.booleanIntersects(finalPolygon, existing)) {
        const trimmed = trimPolygon(finalPolygon, existing);
        if (!trimmed || turf.area(trimmed) < 1) {
          showError("❌ Polygon fully overlaps existing shape");
          layer.remove();
          return;
        }
        finalPolygon = trimmed;
        showError("⚠️Overlap detected. Shape trimmed automatically.");
      }
    }

    geojson = finalPolygon as Feature<Geometry>;

    const color = SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];
    if ((layer as any).setStyle) {
      (layer as any).setStyle({
        color: color.stroke,
        fillColor: color.fill,
        fillOpacity: 0.4,
        weight: 3,
      });
    }

    geojson.properties = {
      ...geojson.properties,
      id: Date.now(),
      shapeType,
      strokeColor: color.stroke,
      fillColor: color.fill,
    };

    setFeatures(prev => [...prev, geojson]);
  };

  const onEdited = (e: any) => {
    e.layers.eachLayer((layer: any) => {
      const geojson = layer.toGeoJSON() as Feature<Geometry>;
      setFeatures(prev =>
        prev.map(f => (f.properties?.id === geojson.properties?.id ? geojson : f))
      );
    });
  };

  const onDeleted = (e: any) => {
    e.layers.eachLayer((layer: any) => {
      const geojson = layer.toGeoJSON() as Feature<Geometry>;
      setFeatures(prev => prev.filter(f => f !== geojson));
    });
  };

  const handleSearch = async () => {
    if (!searchText) return;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`
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
          onClick={() => document.querySelector(".toolbar-panel")?.classList.toggle("open")}
        >
          ☰
        </button>
        <div className="toolbar-panel">
          <div className="rt-title">Map Tools</div>
          <input
            className="rt-search"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search place"
          />
          <button className="rt-btn" onClick={handleSearch}>
            🔍
          </button>
          {/* ✅ Updated Export Button */}
          <button className="rt-btn export" onClick={exportGeoJSON}>
            ⬇ Export
          </button>
          <div className="rt-divider" />
          <button className="rt-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            🌗 Theme
          </button>
        </div>
      </div>

      <MapContainer center={[20.5937, 78.9629]} zoom={5} zoomControl={false} className="map-container">
        <MapRefSetter mapRef={mapRef} />
        <CustomZoom />
        <TileLayer
          url={
            theme === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />

        <FeatureGroup ref={featureGroupRef}>
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
                positions={(f.geometry as any).coordinates[0].map((p: any) => [p[1], p[0]])}
                pathOptions={{ color: stroke, fillColor: fill, fillOpacity: 0.4, weight: 3 }}
              />
            );

          if (gType === "linestring")
            return (
              <Polyline
                key={i}
                positions={(f.geometry as any).coordinates.map((p: any) => [p[1], p[0]])}
                pathOptions={{ color: stroke, weight: 3 }}
              />
            );

          if (gType === "point" && f.properties?.radius)
            return (
              <Circle
                key={i}
                center={[(f.geometry as any).coordinates[1], (f.geometry as any).coordinates[0]]}
                radius={f.properties.radius}
                pathOptions={{ color: stroke, fillColor: fill, fillOpacity: 0.4, weight: 3 }}
              />
            );

          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
