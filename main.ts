// Puerto Alba — main.ts
// Entry program: copies game/ and screenshots/ into /output and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Runs on Node 22, standard library only, no network.
import { buildDossier } from "./vendor/makefun-game.ts";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

await mkdir(outDir, { recursive: true });
await cp(path.join(repoRoot, "game"), path.join(outDir, "game"), { recursive: true });
await cp(path.join(repoRoot, "screenshots"), path.join(outDir, "screenshots"), { recursive: true });

const dossier = await buildDossier(repoRoot, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
});

await writeFile(path.join(outDir, "dossier.json"), dossier);
console.log("Puerto Alba dossier written to " + path.join(outDir, "dossier.json"));
