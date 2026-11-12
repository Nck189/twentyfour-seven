/** Every decor item's picture (shop, farm, rewards). A plain module so server pages can use it too. */
import type { ComponentType } from "react";
import type { DecorId } from "@/content/decor";
import { Fence, Flowers, PathTile, Pond } from "./Plot";
import {
  CafeTable,
  Fireworks,
  GardenLantern,
  Jasmine,
  Krathong,
  Mailbox,
  RedLantern,
  StarTree,
  WaterBowl,
} from "./Festival";

export const DECOR_ART: Record<DecorId, ComponentType<{ className?: string }>> = {
  fence: Fence,
  path: PathTile,
  flowers: Flowers,
  pond: Pond,
  fireworks: Fireworks,
  red_lantern: RedLantern,
  water_bowl: WaterBowl,
  jasmine: Jasmine,
  krathong: Krathong,
  star_tree: StarTree,
  garden_lantern: GardenLantern,
  mailbox: Mailbox,
  cafe_table: CafeTable,
};
