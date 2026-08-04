#!/usr/bin/env node
/**
 * setup-google-drive.mjs
 *
 * Automates what CAN be automated for Stippo ↔ Google Drive:
 * 1. Opens the right Google Cloud Console pages in your browser
 * 2. Asks you to paste the Client ID
 * 3. Writes NEXT_PUBLIC_GOOGLE_CLIENT_ID into .env (no quotes)
 * 4. Reminds you to restart pnpm dev
 *
 * You still create the OAuth client once in the browser (Google requires it).
 * End users never run this — only the Stippo admin.
 *
 * Usage:  pnpm setup:drive
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";

const ROOT = resolve(process.cwd());
const ENV_PATH = resolve(ROOT, ".env");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");

const URLS = {
  enableDrive:
    "https://console.cloud.google.com/apis/library/drive.googleapis.com",
  credentials: "https://console.cloud.google.com/apis/credentials",
  consent: "https://console.cloud.google.com/apis/credentials/consent",
};

function openUrl(url) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

function ensureEnvFile() {
  if (!existsSync(ENV_PATH)) {
    if (existsSync(ENV_EXAMPLE)) {
      copyFileSync(ENV_EXAMPLE, ENV_PATH);
      console.log("Creato .env da .env.example\n");
    } else {
      writeFileSync(ENV_PATH, "", "utf8");
      console.log("Creato .env vuoto\n");
    }
  }
}

function upsertEnv(key, value) {
  let text = readFileSync(ENV_PATH, "utf8");
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) {
    text = text.replace(re, line);
  } else {
    text = text.trimEnd() + `\n\n# Stippo Google Drive (vault)\n${line}\n`;
  }
  writeFileSync(ENV_PATH, text, "utf8");
}

function readEnv(key) {
  if (!existsSync(ENV_PATH)) return "";
  const text = readFileSync(ENV_PATH, "utf8");
  const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

async function main() {
  const rl = createInterface({ input, output });

  console.log(`
╔══════════════════════════════════════════╗
║   Stippo — setup Google Drive (1 volta)  ║
╚══════════════════════════════════════════╝

Questo script è per TE (chi gestisce Stippo).
Gli architetti NON lo usano: loro premono solo
“Usa il mio Google Drive” e fanno login.

`);

  ensureEnvFile();
  const existing = readEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  if (existing) {
    console.log(`Già configurato:\n  NEXT_PUBLIC_GOOGLE_CLIENT_ID=${existing}\n`);
    const again = await rl.question("Vuoi sostituirlo? (s/N) ");
    if (!/^s/i.test(again.trim())) {
      console.log("\nOk, non cambio nulla. Riavvia con:  pnpm dev\n");
      rl.close();
      return;
    }
  }

  console.log(`Ti apro 3 pagine Google. Segui questi passi corti:

A) Se non hai un progetto: creane uno (es. "Stippo").
B) Pagina 1 — abilita "Google Drive API" → Enable.
C) Pagina 2 — OAuth consent screen:
   - External (o Internal se Workspace)
   - Nome app: Stippo
   - Salva (scopes: lascia default o aggiungi drive.file se chiesto)
D) Pagina 3 — Credentials → Create credentials → OAuth client ID
   - Application type: Web application
   - Name: Stippo Web
   - Authorized JavaScript origins:
       http://localhost:3000
   - Authorized redirect URIs (opzionale per GIS):
       http://localhost:3000
   - Create → copia il Client ID
`);

  await rl.question("Invio per aprire le pagine… ");

  openUrl(URLS.enableDrive);
  await sleep(800);
  openUrl(URLS.consent);
  await sleep(800);
  openUrl(URLS.credentials);

  console.log("\nQuando hai il Client ID, incollalo qui (senza virgolette).\n");
  let clientId = (await rl.question("Client ID: ")).trim().replace(/^["']|["']$/g, "");

  while (!clientId.includes(".apps.googleusercontent.com") && clientId.length < 20) {
    console.log("Non sembra un Client ID Google (di solito finisce con .apps.googleusercontent.com).");
    clientId = (await rl.question("Client ID: ")).trim().replace(/^["']|["']$/g, "");
    if (!clientId) {
      console.log("Annullato.");
      rl.close();
      return;
    }
    if (clientId.includes(".apps.googleusercontent.com")) break;
    const force = await rl.question("Usarlo comunque? (s/N) ");
    if (/^s/i.test(force.trim())) break;
  }

  upsertEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", clientId);

  console.log(`
✓ Salvato in .env

Prossimi passi:
  1. Ferma il server se è acceso (Ctrl+C)
  2. pnpm dev
  3. Apri http://localhost:3000/app/vault
  4. Premi “Usa il mio Google Drive” e fai login

Gli utenti finali faranno solo il punto 4 col loro Gmail.
`);

  rl.close();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
