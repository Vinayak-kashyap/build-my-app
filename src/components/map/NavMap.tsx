import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerToken } from "@/lib/roadpulse";
import type { LatLng, ScoredRoute } from "@/lib/routing";
import { healthTone } from "@/lib/routing";
import type { ReportRow } from "@/lib/roadpulse";

type Props = {
  routes: ScoredRoute[];
  activeRouteId: string | null;
  from: LatLng | null;
  to: LatLng | null;
  userPosition: LatLng | null;
  /** degrees; map rotates so the travel direction points up */
  heading: number;
  autoRotate: boolean;
  fitKey: number;
  onHazardSelect: (report: ReportRow) => void;
};

export function NavMap({
  routes,
  activeRouteId,
  from,
  to,
  userPosition,
  heading,
  autoRotate,
  fitKey,
  onHazardSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotatorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onHazardSelect);
  selectRef.current = onHazardSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [12.9716, 77.5946],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    pinLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Route polylines + hazard markers.
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const route of routes) {
      const active = route.id === activeRouteId;
      L.polyline(
        route.coordinates.map((c) => [c.lat, c.lng] as [number, number]),
        {
          color: active ? healthTone(route.healthScore) : "#8B949E",
          weight: active ? 7 : 4,
          opacity: active ? 0.95 : 0.4,
          lineJoin: "round",
        },
      ).addTo(layer);

      if (!active) continue;
      for (const hazard of route.hazards) {
        const color = markerToken(hazard.report);
        L.marker([hazard.report.latitude, hazard.report.longitude], {
          icon: L.divIcon({
            html: `<span class="rp-marker${hazard.report.severity === "critical" ? " rp-pulse" : ""}" style="--rp:${color}"></span>`,
            className: "rp-icon",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          title: "Hazard on route",
        })
          .on("click", () => selectRef.current(hazard.report))
          .addTo(layer);
      }
    }
  }, [routes, activeRouteId]);

  // Origin / destination pins.
  useEffect(() => {
    const layer = pinLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (from) {
      L.circleMarker([from.lat, from.lng], {
        radius: 7,
        color: "#00D4FF",
        weight: 3,
        fillColor: "#0D1117",
        fillOpacity: 1,
      }).addTo(layer);
    }
    if (to) {
      L.marker([to.lat, to.lng], {
        icon: L.divIcon({
          html: '<span class="rp-dest"></span>',
          className: "rp-icon",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        title: "Destination",
      }).addTo(layer);
    }
  }, [from, to]);

  // User puck.
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!userPosition) return;
    L.marker([userPosition.lat, userPosition.lng], {
      icon: L.divIcon({
        html: '<span class="rp-user"></span>',
        className: "rp-icon",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
    }).addTo(layer);
  }, [userPosition]);

  // Fit the chosen route.
  useEffect(() => {
    const map = mapRef.current;
    const active = routes.find((r) => r.id === activeRouteId) ?? routes[0];
    if (!map || !active?.coordinates.length) return;
    map.fitBounds(
      L.latLngBounds(active.coordinates.map((c) => [c.lat, c.lng] as [number, number])),
      { padding: [60, 160] },
    );
  }, [fitKey, activeRouteId, routes]);

  // Follow the driver while navigating.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !autoRotate || !userPosition) return;
    map.setView([userPosition.lat, userPosition.lng], Math.max(map.getZoom(), 17), {
      animate: true,
    });
  }, [autoRotate, userPosition]);

  // Auto-rotating map: rotate the tile canvas, keep UI upright.
  useEffect(() => {
    const el = rotatorRef.current;
    if (!el) return;
    el.style.transform = autoRotate ? `rotate(${-heading}deg)` : "rotate(0deg)";
    mapRef.current?.invalidateSize();
  }, [heading, autoRotate]);

  return (
    <div
      ref={rotatorRef}
      className="absolute inset-[-25%] z-0 origin-center transition-transform duration-500 ease-out"
    >
      <div ref={containerRef} className="h-full w-full" aria-label="Navigation map" />
    </div>
  );
}
