// Columns of company-wall cards drifting past on either side of an auth page,
// shown on wide screens only. Purely decorative sample data.
import { Monogram, StatusBadge } from "../applications/wall/wallParts";
import { WALL, type WallEntry } from "../landing/landingData";
import { Avatar } from "../landing/landingParts";
import "./auth-motion.css";

const rotate = (offset: number) => [...WALL.slice(offset), ...WALL.slice(0, offset)].slice(0, 6);

const COLUMNS: Record<"left" | "right", { items: WallEntry[]; up: boolean; duration: string }[]> = {
  left: [
    { items: rotate(0), up: true, duration: "70s" },
    { items: rotate(6), up: false, duration: "86s" },
  ],
  right: [
    { items: rotate(3), up: false, duration: "78s" },
    { items: rotate(9), up: true, duration: "64s" },
  ],
};

function WallTile({ entry }: { entry: WallEntry }) {
  return (
    // A bottom margin (not a gap) keeps the doubled column exactly two
    // copies tall, so the loop at -50% is seamless.
    <div className="mb-4 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between">
        <Monogram name={entry.company} size={28} />
        <Avatar id={entry.owner} size={20} />
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold text-foreground">{entry.company}</p>
      <p className="truncate text-[11px] text-muted-foreground">{entry.role}</p>
      <div className="mt-2">
        <StatusBadge status="applied" />
      </div>
    </div>
  );
}

function WallSide({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`absolute inset-y-0 hidden w-[24vw] max-w-[22rem] gap-4 px-6 opacity-55 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)] xl:flex ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      {COLUMNS[side].map((column, index) => (
        <div key={index} className="flex-1 overflow-hidden">
          <div
            className={column.up ? "auth-column-up" : "auth-column-down"}
            style={{ ["--column-duration" as string]: column.duration }}
          >
            {[...column.items, ...column.items].map((entry, tile) => (
              <WallTile key={tile} entry={entry} />
            ))}
          </div>
        </div>
      ))}
      {/* Fade the inner edge into the page. */}
      <div
        className={`absolute inset-y-0 w-1/2 from-transparent to-background ${
          side === "left" ? "right-0 bg-gradient-to-r" : "left-0 bg-gradient-to-l"
        }`}
      />
    </div>
  );
}

export function WallBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <WallSide side="left" />
      <WallSide side="right" />
    </div>
  );
}
