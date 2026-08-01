import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerToken, severityWeight, type ReportRow } from "@/lib/roadpulse";
import { riskToken, type PredictionRow } from "@/lib/predictions";

export type LayerMode = "standard" | "satellite" | "heatmap";

const TILES: Record<LayerMode, { url: string; attribution: string }> = {
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  heatmap: {
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
};

type Props = {
  reports: ReportRow[];
  layer: LayerMode;
  center: [number, number];
  userPosition: { lat: number; lng: number } | null;
  recenterKey: number;
  onSelect: (report: ReportRow) => void;
  /** Amber "At Risk" forecast overlay (Prediction module). */
  predictions?: PredictionRow[];
  showPredictions?: boolean;
  onSelectPrediction?: (prediction: PredictionRow) => void;
};

/** Cheap grid clustering — avoids an extra plugin dependency. */
function cluster(reports: ReportRow[], zoom: number) {
  if (zoom >= 15) return reports.map((r) => ({ key: r.id, reports: [r] }));
  const cellSize = zoom >= 13 ? 0.004 : zoom >= 11 ? 0.02 : 0.1;
  const buckets = new Map<string, ReportRow[]>();
  for (const r of reports) {
    const key = `${Math.round(r.latitude / cellSize)}:${Math.round(r.longitude / cellSize)}`;
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }
  return [...buckets.entries()].map(([key, list]) => ({ key, reports: list }));
}

export function RoadMap({
  reports,
  layer,
  center,
  userPosition,
  recenterKey,
  onSelect,
  predictions = [],
  showPredictions = true,
  onSelectPrediction,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const glowLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const riskLayerRef = useRef<L.LayerGroup | null>(null);
  const reportsRef = useRef(reports);
  const layerRef = useRef(layer);
  const selectRef = useRef(onSelect);
  reportsRef.current = reports;
  layerRef.current = layer;
  selectRef.current = onSelect;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });
    mapRef.current = map;
    glowLayerRef.current = L.layerGroup().addTo(map);
    riskLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    map.on("zoomend", () => render());
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile layer switching.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    const conf = TILES[layer];
    tileRef.current = L.tileLayer(conf.url, {
      attribution: conf.attribution,
      maxZoom: 19,
    }).addTo(map);
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  function render() {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const glowLayer = glowLayerRef.current;
    if (!map || !markerLayer || !glowLayer) return;

    markerLayer.clearLayers();
    glowLayer.clearLayers();
    const zoom = map.getZoom();
    const groups = cluster(reportsRef.current, zoom);

    for (const group of groups) {
      const first = group.reports[0];
      const worst = group.reports.reduce((a, b) =>
        severityWeight(b.severity) > severityWeight(a.severity) ? b : a,
      );
      const color = markerToken(worst);
      const lat =
        group.reports.reduce((sum, r) => sum + r.latitude, 0) / group.reports.length;
      const lng =
        group.reports.reduce((sum, r) => sum + r.longitude, 0) / group.reports.length;

      // Severity heat glow: radius scales with report count and average severity.
      const avgSeverity =
        group.reports.reduce((sum, r) => sum + severityWeight(r.severity), 0) /
        group.reports.length;
      const intensity = Math.min(1, (group.reports.length * avgSeverity) / 12);
      L.circle([lat, lng], {
        radius: 30 + intensity * 220,
        color: "transparent",
        fillColor: color,
        fillOpacity: layerRef.current === "heatmap" ? 0.15 + intensity * 0.4 : 0.08 + intensity * 0.15,
        interactive: false,
      }).addTo(glowLayer);

      const isCluster = group.reports.length > 1;
      const critical = worst.severity === "critical";
      const html = isCluster
        ? `<span class="rp-cluster" style="--rp:${color}">${group.reports.length}</span>`
        : `<span class="rp-marker${critical ? " rp-pulse" : ""}" style="--rp:${color}"></span>`;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: "rp-icon",
          iconSize: isCluster ? [36, 36] : [22, 22],
          iconAnchor: isCluster ? [18, 18] : [11, 11],
        }),
        keyboard: true,
        title: isCluster ? `${group.reports.length} reports` : (first.address ?? "Road report"),
      });

      marker.on("click", () => {
        if (isCluster && zoom < 17) {
          map.setView([lat, lng], Math.min(17, zoom + 3));
          return;
        }
        selectRef.current(worst);
      });
      marker.addTo(markerLayer);
    }
  }

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  // Amber "At Risk" prediction overlay.
  useEffect(() => {
    const layer = riskLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showPredictions) return;
    for (const p of predictions) {
      const color = riskToken(p.risk_level);
      L.circle([p.latitude, p.longitude], {
        radius: 120 + (p.risk_score / 100) * 260,
        color,
        weight: 2,
        dashArray: "6 6",
        fillColor: color,
        fillOpacity: 0.12 + (p.risk_score / 100) * 0.16,
      })
        .on("click", () => onSelectPrediction?.(p))
        .addTo(layer);
    }
  }, [predictions, showPredictions, onSelectPrediction]);

  // User location dot.
  useEffect(() => {
    const layerGroup = userLayerRef.current;
    if (!layerGroup) return;
    layerGroup.clearLayers();
    if (!userPosition) return;
    L.marker([userPosition.lat, userPosition.lng], {
      icon: L.divIcon({
        html: '<span class="rp-user"></span>',
        className: "rp-icon",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
    }).addTo(layerGroup);
  }, [userPosition]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, Math.max(mapRef.current.getZoom(), 15), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return <div ref={containerRef} className="absolute inset-0 z-0" aria-label="Road condition map" />;
}
