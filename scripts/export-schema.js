// scripts/export-schema.js
import { execSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const OUT_FILE = path.resolve("docs/bookschema_postgres.sql");

const cmd = `pg_dump --schema-only --no-owner --no-privileges --host=${DB_HOST} --port=${DB_PORT} --username=${DB_USER} ${DB_NAME}`;

console.log("Exportiere Schema mit:", cmd.replace(process.env.DB_USER, "<user>"));

try {
  const result = execSync(cmd, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } });
  fs.writeFileSync(OUT_FILE, result);
  console.log("Schema erfolgreich exportiert nach:", OUT_FILE);
} catch (err) {
  console.error("Fehler beim Schema-Export:", err.message);
  process.exit(1);
}
