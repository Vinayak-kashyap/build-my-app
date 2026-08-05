import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { urgencyBand, type QueueRow } from "@/lib/dashboard";
import {
  DAMAGE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  formatCoords,
  type ReportRow,
} from "@/lib/roadpulse";


const HEAD = [
  "Rank",
  "Location",
  "GPS",
  "Damage",
  "Severity",
  "Reports",
  "Confidence",
  "Urgency",
  "Status",
  "AI suggestion",
];

function rows(queue: QueueRow[]) {
  return queue.map((r, i) => [
    String(i + 1),
    r.address ?? "Unnamed road",
    formatCoords(r.latitude, r.longitude),
    r.damage_types.map((d) => DAMAGE_LABELS[d]).join(", "),
    SEVERITY_LABELS[r.severity],
    String(r.report_count),
    `${Math.round(Number(r.confidence))}%`,
    urgencyBand(Number(r.priority_score)).label,
    STATUS_LABELS[r.status],
    r.ai_suggestion ?? "—",
  ]);
}

export function downloadQueuePdf(queue: QueueRow[], jurisdiction: string, rangeLabel: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("RoadPulse — Priority Repair Queue", 14, 16);
  doc.setFontSize(10);
  doc.text(`${jurisdiction} · ${rangeLabel} · generated ${new Date().toLocaleString()}`, 14, 23);
  autoTable(doc, {
    head: [HEAD],
    body: rows(queue),
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 9: { cellWidth: 60 } },
  });
  doc.save(`roadpulse-queue-${Date.now()}.pdf`);
}

export function downloadQueueCsv(queue: QueueRow[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [HEAD, ...rows(queue)].map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `roadpulse-queue-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
