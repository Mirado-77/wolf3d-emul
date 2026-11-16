import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Wolf3D from "./demos/Wolf3D";
import "./index.css";

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-4 text-[#e6e1d7]">
      <h1 className="text-lg font-semibold">Wolf3D — Le Palais du Crépuscule</h1>
      <div className="aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-xl">
        <Wolf3D running accent="#b5916c" />
      </div>
      <p className="font-mono text-xs text-[#aaa499]">
        ZQSD / WASD move · arrows or drag to turn · Shift sprint · E / click cast · F door · R torch · L / M potions
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
