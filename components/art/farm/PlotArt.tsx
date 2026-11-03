/**
 * One plot as the farm shows it: bed, mutation glow behind, the crop, mutation particles in
 * front, the quality star. Night dims it with the farm's own night veil (not the UI dark mode).
 */
import type { CropId } from "@/content/crops";
import { MUTATION_MULTIPLIER, type MutationId, type Quality } from "@/content/game";
import { CropBody } from "./CropArt";
import { MutationFx, MutationGlyph, QualityStar } from "./Fx";
import { Art } from "./parts";
import { PlotBed } from "./Plot";

export type PlotArtProps = {
  cropId?: CropId | null;
  stage?: 0 | 1 | 2 | 3;
  status?: "growing" | "ready" | "dead" | "compost";
  weeds?: boolean;
  wiltLevel?: number;
  quality?: Quality;
  mutations?: readonly MutationId[];
  locked?: boolean;
  night?: boolean;
  /**
   * Small tiles (the field): only the strongest mutation, as a corner badge, and a faint sprout
   * on an empty plot inviting a seed — calm at a glance. Full effects in the close-up.
   */
  tile?: boolean;
  className?: string;
  label?: string;
};

export function PlotArt({
  cropId,
  stage = 0,
  status = "growing",
  weeds = false,
  wiltLevel = 0,
  quality = "normal",
  mutations = [],
  locked = false,
  night = false,
  tile = false,
  className = "h-12 w-12",
  label,
}: PlotArtProps) {
  // The strongest mutation (by multiplier) is the one a tile shows.
  const top =
    cropId && status !== "dead" && status !== "compost"
      ? [...mutations].sort((a, b) => MUTATION_MULTIPLIER[b] - MUTATION_MULTIPLIER[a])[0]
      : undefined;
  return (
    <Art className={className} label={label}>
      <PlotBed locked={locked} />
      {!cropId && !locked && tile && (
        <g opacity={0.35}>
          <rect x={22.5} y={26} width={3} height={10} rx={1.5} fill="var(--art-stem)" />
          <ellipse cx={19} cy={27} rx={4.6} ry={2.6} fill="var(--art-leaf-3)" transform="rotate(-25 19 27)" />
          <ellipse cx={29} cy={26} rx={4.6} ry={2.6} fill="var(--art-leaf-3)" transform="rotate(25 29 26)" />
        </g>
      )}
      {cropId && !locked && (
        <g transform="translate(0 -3)" style={{ ["--shadow-on" as string]: "var(--art-soil-dark)" }}>
          {!tile && <MutationFx ids={mutations} layer="behind" />}
          <CropBody cropId={cropId} stage={stage} status={status} weeds={weeds} wiltLevel={wiltLevel} />
          {!tile && <MutationFx ids={mutations} layer="front" />}
          {status === "ready" && <QualityStar quality={quality} />}
        </g>
      )}
      {tile && top && (
        <g transform="translate(1 1) scale(0.3)">
          <MutationGlyph id={top} />
        </g>
      )}
      {night && <rect width={48} height={48} fill="var(--sky-night-veil)" opacity={0.28} />}
    </Art>
  );
}
