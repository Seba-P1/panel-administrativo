import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--watch", "server/index.mjs"], {
    stdio: "inherit",
    env: { ...process.env, APP_URL: "http://localhost:5173" },
  }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  }),
];
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    children.forEach((p) => p.kill());
    process.exit();
  });
