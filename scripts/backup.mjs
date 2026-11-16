import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.env.DATA_DIR || "data");
if (!existsSync(resolve(dir, "nexo.sqlite")))
  throw new Error("No existe la base de datos.");
const out = resolve(process.env.BACKUP_DIR || "backups");
mkdirSync(out, { recursive: true });
const file = resolve(
  out,
  "nexo-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
);
const db = new DatabaseSync(resolve(dir, "nexo.sqlite"));
db.exec(
  "PRAGMA busy_timeout=10000; VACUUM INTO '" +
    file.replaceAll("'", "''") +
    "';",
);
db.close();
chmodSync(file, 0o600);
console.log(
  "Copia consistente creada: " +
    file +
    "\nContiene datos privados, cuenta y tokens hasheados. Copiar fuera del servidor y proteger.",
);
