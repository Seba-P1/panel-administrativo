import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
const source = process.argv[2];
if (!source || !process.argv.includes("--confirm"))
  throw new Error(
    "Detene la aplicacion. Uso: npm run restore -- /ruta/copia.sqlite --confirm",
  );
const path = resolve(source);
if (!existsSync(path)) throw new Error("Copia inexistente.");
const check = new DatabaseSync(path, { readOnly: true });
const result = check.prepare("PRAGMA integrity_check").get();
if (!Object.values(result).includes("ok"))
  throw new Error("La copia no pasa integrity_check.");
check.prepare("SELECT id FROM admin").get();
check.close();
const dir = resolve(process.env.DATA_DIR || "data");
mkdirSync(dir, { recursive: true });
const target = resolve(dir, "nexo.sqlite");
if (path === target) throw new Error("Origen y destino no pueden ser iguales.");
if (existsSync(target))
  copyFileSync(target, target + ".antes-de-restaurar-" + Date.now());
for (const suffix of ["-wal", "-shm"])
  if (existsSync(target + suffix)) unlinkSync(target + suffix);
copyFileSync(path, target);
const db = new DatabaseSync(target);
db.exec("DELETE FROM sessions");
db.close();
console.log(
  "Base restaurada y sesiones invalidadas. Inicia la aplicacion. Debe estar detenida durante todo este proceso.",
);
