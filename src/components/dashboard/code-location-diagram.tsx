import { cn } from "@/components/ui";

export type CodeLocationZone = "door" | "engine" | "boot";

const ZONE_KEYWORDS: Record<CodeLocationZone, RegExp> = {
  door: /door|pillar|shut|b-pillar/i,
  engine: /bonnet|strut|slam panel|engine|bulkhead/i,
  boot: /boot|spare wheel|trunk|tailgate/i,
};

const ZONE_LABEL: Record<CodeLocationZone, string> = {
  door: "Door pillar",
  engine: "Under bonnet",
  boot: "Boot / spare wheel",
};

// Marker positions on the side-view drawing (viewBox 0 0 320 130).
const ZONE_POINT: Record<CodeLocationZone, { x: number; y: number }> = {
  engine: { x: 62, y: 62 },
  door: { x: 158, y: 74 },
  boot: { x: 268, y: 64 },
};

/** Map a provider's free-text hint to the areas of the car it mentions. */
export function zonesFromHint(hint: string | null | undefined): CodeLocationZone[] {
  if (!hint) return [];
  return (Object.keys(ZONE_KEYWORDS) as CodeLocationZone[]).filter((zone) => ZONE_KEYWORDS[zone].test(hint));
}

/** Plate Location Diagram (PRD 3.2.2): where the paint code label sits on the car. */
export function CodeLocationDiagram({ hint }: { hint: string }) {
  const zones = zonesFromHint(hint);
  if (zones.length === 0) return null;

  return (
    <figure className="mt-3">
      <svg viewBox="0 0 320 130" className="w-full max-w-sm text-slate-400" role="img" aria-label={`Paint code label: ${zones.map((z) => ZONE_LABEL[z]).join(", ")}`}>
        {/* Car body, side view, front on the left. */}
        <path
          d="M14 92 L20 70 Q24 60 40 58 L92 54 L128 26 Q136 20 150 20 L218 20 Q232 20 242 30 L270 54 L296 58 Q308 61 308 74 L308 92 Z"
          fill="#f1f5f9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Windows and door shut line. */}
        <path d="M104 54 L134 30 Q139 26 148 26 L180 26 L180 54 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />
        <path d="M188 26 L216 26 Q226 26 234 34 L254 54 L188 54 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />
        <line x1="184" y1="24" x2="184" y2="92" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Wheels. */}
        <circle cx="76" cy="94" r="18" fill="#334155" />
        <circle cx="76" cy="94" r="7" fill="#cbd5e1" />
        <circle cx="250" cy="94" r="18" fill="#334155" />
        <circle cx="250" cy="94" r="7" fill="#cbd5e1" />
        {zones.map((zone) => {
          const p = ZONE_POINT[zone];
          return (
            <g key={zone}>
              <circle cx={p.x} cy={p.y} r="13" className="fill-brand-500/25 animate-pulse" />
              <circle cx={p.x} cy={p.y} r="6" className="fill-brand-600" stroke="white" strokeWidth="2" />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-1.5">
        {zones.map((zone) => (
          <span key={zone} className={cn("rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700")}>
            {ZONE_LABEL[zone]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
