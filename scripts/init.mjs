import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(
    "Ya existe .env. No se modifica. El codigo de instalacion esta en SETUP_TOKEN dentro de ese archivo.",
  );
} else {
  const token = randomBytes(32).toString("hex");
  const content = readFileSync(".env.example", "utf8").replace(
    "REEMPLAZAR_CON_UN_SECRETO_ALEATORIO_DE_64_CARACTERES",
    token,
  );
  writeFileSync(".env", content, { mode: 0o600 });
  console.log(
    "Archivo .env creado. CODIGO DE INSTALACION (solo para crear tu cuenta):\n" +
      token +
      "\nNo lo compartas. Eliminar SETUP_TOKEN del entorno despues de crear la cuenta es recomendable.",
  );
}
