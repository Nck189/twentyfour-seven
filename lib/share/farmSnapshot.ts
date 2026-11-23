/**
 * What of her own farm goes on a shared picture (review fix A4): the crops she grows, the animals
 * she has and her farmhouse. A flattering portrait, so crops are drawn ripe whatever their stage
 * today. Nothing private: ids and a level only.
 */
import { isDecorId, type DecorId } from "@/content/decor";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ANIMALS, isAnimalId, type AnimalId } from "@/content/animals";
import { CROPS, RARITIES, isCropId, type CropId } from "@/content/crops";

export type FarmSnapshot = { house: number; crops: CropId[]; animals: AnimalId[]; decor: DecorId[] };

/** A farm with nothing planted yet still gets a friendly scene. */
export const GENERIC_FARM: FarmSnapshot = {
  house: 1,
  crops: ["strawberry", "radish", "corn"],
  animals: [],
  decor: [],
};

const rank = (r: (typeof RARITIES)[number]) => RARITIES.indexOf(r);

export function buildSnapshot(
  plots: readonly { crop_id: string | null }[],
  animals: readonly { species: string; created_at: string }[],
  house: number,
  /** Her decor and its yard spot (null = in storage): the first placed one joins the picture. */
  decorRows: readonly { item_id: string; spot: number | null }[] = [],
): FarmSnapshot {
  const decor = [...decorRows]
    .filter((d): d is { item_id: DecorId; spot: number } => d.spot !== null && isDecorId(d.item_id))
    .sort((a, b) => a.spot - b.spot)
    .slice(0, 1)
    .map((d) => d.item_id);
  const crops = [...new Set(plots.map((p) => p.crop_id).filter(isCropId))]
    .sort((a, b) => rank(CROPS[b].rarity) - rank(CROPS[a].rarity) || a.localeCompare(b))
    .slice(0, 3);
  const pets = [...animals]
    .filter((a): a is { species: AnimalId; created_at: string } => isAnimalId(a.species))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((a) => a.species)
    .filter((s, i, all) => all.indexOf(s) === i && !!ANIMALS[s])
    .slice(0, 2);
  if (crops.length === 0 && pets.length === 0) return { ...GENERIC_FARM, decor };
  // At most four pieces stand between Som and the farmhouse, so each stays big enough to read.
  // Nothing planted yet (animals only): the generic crops keep the scene a farm.
  const shown = (crops.length ? crops : GENERIC_FARM.crops).slice(0, 4 - pets.length);
  // A placed decor item is the fifth piece at most (the picture fits five, smaller).
  return { house: Math.max(1, Math.floor(house) || 0), crops: shown, animals: pets, decor };
}

/** Her own rows (RLS), read-only. Any failure falls back to the generic scene. */
export async function loadFarmSnapshot(client: SupabaseClient): Promise<FarmSnapshot> {
  try {
    const [plots, animals, upgrades, decor] = await Promise.all([
      client.from("plots").select("crop_id"),
      client.from("animals").select("species, created_at"),
      client.from("upgrades").select("track, level"),
      client.from("decor").select("item_id, spot"),
    ]);
    const house =
      ((upgrades.data as { track: string; level: number }[] | null) ?? []).find((u) => u.track === "house")
        ?.level ?? 0;
    return buildSnapshot(
      (plots.data as { crop_id: string | null }[] | null) ?? [],
      (animals.data as { species: string; created_at: string }[] | null) ?? [],
      house,
      (decor.data as { item_id: string; spot: number | null }[] | null) ?? [],
    );
  } catch {
    return GENERIC_FARM;
  }
}
