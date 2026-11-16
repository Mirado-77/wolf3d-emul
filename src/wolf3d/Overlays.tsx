import { BASE } from "./config";

/** Main-menu picture shown while loading, or when the title screen is open. */
export function TitleScreen({ loaded, error, onEnter }: { loaded: boolean; error: boolean; onEnter: () => void }) {
  return (
    <button
      className="absolute inset-0 grid place-items-center bg-cover bg-center text-center"
      style={{ backgroundImage: `url(${BASE}main_menu.jpg)` }}
      onClick={onEnter}
      disabled={!loaded}
    >
      <div className="rounded-lg bg-black/45 px-6 py-4 backdrop-blur-[2px]" style={{ fontFamily: "alagard, serif" }}>
        <p lang="fr" className="text-xl text-stone-100 sm:text-3xl">Le Palais du Crépuscule</p>
        <p className="mt-2 text-xs text-stone-300 sm:text-sm">
          {error ? "Could not load the game assets." : loaded ? "Click to enter the palace" : "Loading the palace…"}
        </p>
      </div>
    </button>
  );
}

/** Hint shown in attract mode, when the game does not have keyboard focus. */
export function ClickToPlayHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[58%] text-center">
      <span className="rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] text-white/85">
        click to play · E / click cast · F door · L / M potions
      </span>
    </div>
  );
}
