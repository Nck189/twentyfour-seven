/**
 * Dev-only art sheet (QA_QC G3, BUILD_PLAN M6): every crop × stage × state at 48/96/192 px on
 * day and night, plus mutations, quality, decor and skies. Not linked from the app; 404 in prod.
 * Labels are asset ids (a QA tool, not user-facing copy).
 */
import { notFound } from "next/navigation";
import { CROP_IDS } from "@/content/crops";
import { MUTATION_IDS, QUALITIES } from "@/content/game";
import { FarmSky, type SkyPhase } from "@/components/art/farm/FarmSky";
import { MutationIcon } from "@/components/art/farm/Fx";
import { Capsule, CapsuleMachine, RarityLight } from "@/components/art/farm/Capsule";
import { RARITIES } from "@/content/crops";
import { PlotArt } from "@/components/art/farm/PlotArt";
import { Fence, Flowers, PathTile, Pond } from "@/components/art/farm/Plot";

const STAGES = [0, 1, 2, 3] as const;

function Cell({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="flex flex-col items-center gap-1">
      {children}
      <figcaption className="text-[10px] text-[var(--ui-text-muted)]">{caption}</figcaption>
    </figure>
  );
}

function Sheet({ night }: { night: boolean }) {
  const bg = night ? "bg-[var(--sky-night-bottom)]" : "bg-[var(--sky-day-bottom)]";
  return (
    <section className={`${bg} relative rounded-xl p-3`} data-sheet={night ? "night" : "day"}>
      {night && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--sky-night-veil)] opacity-25"
        />
      )}
      <div className="grid gap-3">
        {CROP_IDS.map((id) => (
          <div key={id} className="flex flex-wrap items-end gap-2" data-crop={id}>
            <span className="w-20 text-xs">{id}</span>
            {STAGES.map((s) => (
              <Cell key={s} caption={`s${s}`}>
                <PlotArt cropId={id} stage={s} status={s === 3 ? "ready" : "growing"} />
              </Cell>
            ))}
            <Cell caption="weeds">
              <PlotArt cropId={id} stage={2} weeds />
            </Cell>
            <Cell caption="wilt">
              <PlotArt cropId={id} stage={2} wiltLevel={1} />
            </Cell>
            <Cell caption="gold+dew">
              <PlotArt cropId={id} stage={3} status="ready" quality="gold" mutations={["dew"]} />
            </Cell>
            <Cell caption="96">
              <PlotArt cropId={id} stage={3} status="ready" className="h-24 w-24" />
            </Cell>
            <Cell caption="192">
              <PlotArt cropId={id} stage={3} status="ready" className="h-48 w-48" />
            </Cell>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ArtSheet() {
  if (process.env.NODE_ENV === "production" && !process.env.ART_SHEET) notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-[var(--ui-text)]">
      <section className="flex flex-wrap items-end gap-3" data-section="states">
        <Cell caption="empty">
          <PlotArt />
        </Cell>
        <Cell caption="locked">
          <PlotArt locked />
        </Cell>
        <Cell caption="dead">
          <PlotArt cropId="tomato" status="dead" className="h-24 w-24" />
        </Cell>
        <Cell caption="compost">
          <PlotArt cropId="tomato" status="compost" className="h-24 w-24" />
        </Cell>
        {QUALITIES.map((q) => (
          <Cell key={q} caption={q}>
            <PlotArt cropId="strawberry" stage={3} status="ready" quality={q} className="h-24 w-24" />
          </Cell>
        ))}
      </section>
      <section className="flex flex-wrap items-end gap-3" data-section="mutations">
        {MUTATION_IDS.map((m) => (
          <Cell key={m} caption={m}>
            <div className="flex items-end gap-1">
              <MutationIcon id={m} className="h-8 w-8" />
              <PlotArt cropId="tomato" stage={3} status="ready" mutations={[m]} className="h-24 w-24" />
            </div>
          </Cell>
        ))}
        <Cell caption="all">
          <PlotArt
            cropId="pumpkin"
            stage={3}
            status="ready"
            quality="prismatic"
            mutations={MUTATION_IDS}
            className="h-24 w-24"
          />
        </Cell>
      </section>
      <section className="flex flex-wrap items-end gap-3" data-section="gacha">
        <Cell caption="machine">
          <CapsuleMachine className="h-32 w-32" />
        </Cell>
        {RARITIES.map((r) => (
          <Cell key={r} caption={r}>
            <div className="relative h-24 w-24">
              <RarityLight rarity={r} className="absolute inset-0 h-full w-full" />
              <Capsule rarity={r} className="absolute inset-0 h-full w-full" />
            </div>
          </Cell>
        ))}
      </section>
      <section className="flex flex-wrap items-end gap-3" data-section="decor">
        <Cell caption="fence">
          <Fence className="h-24 w-24" />
        </Cell>
        <Cell caption="path">
          <PathTile className="h-24 w-24" />
        </Cell>
        <Cell caption="flowers">
          <Flowers className="h-24 w-24" />
        </Cell>
        <Cell caption="pond">
          <Pond className="h-24 w-24" />
        </Cell>
      </section>
      <section className="grid grid-cols-2 gap-2" data-section="sky">
        {(["sunrise", "day", "dusk", "night"] as SkyPhase[]).map((p) => (
          <Cell key={p} caption={p}>
            <FarmSky phase={p} className="h-24 w-full rounded-lg" />
          </Cell>
        ))}
      </section>
      <Sheet night={false} />
      <Sheet night />
    </main>
  );
}
