/**
 * One plot as the farm shows it: bed, mutation glow behind, the crop, mutation particles in
 * front, the quality star. Night dims it with the farm's own night veil (not the UI dark mode).
 */
import type { CropId } from "@/content/crops";
import type { MutationId, Quality } from "@/content/game";
import { CropBody } from "./CropArt";
import { MutationFx, QualityStar } from "./Fx";
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
  className = "h-12 w-12",
  label,
}: PlotArtProps) {
  return (
    <Art className={className} label={label}>
      <PlotBed locked={locked} />
      {cropId && !locked && (
        <g transform="translate(0 -3)">
          <MutationFx ids={mutations} layer="behind" />
          <CropBody cropId={cropId} stage={stage} status={status} weeds={weeds} wiltLevel={wiltLevel} />
          <MutationFx ids={mutations} layer="front" />
          {status === "ready" && <QualityStar quality={quality} />}
        </g>
      )}
      {night && <rect width={48} height={48} fill="var(--sky-night-veil)" opacity={0.28} />}
    </Art>
  );
}
