// Проверяет все prompts/*.json: схема, id = имя файла, промт начинается с /anatomy,
// переменные {name} в тексте и в списке variables совпадают, файлы примеров существуют.
// Запуск: npm run validate (Node 22.18+ запускает .ts напрямую).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(ROOT, "schema/prompt.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true }).compile(schema);

const dir = join(ROOT, "prompts");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const ids = new Set<string>();
let failed = 0;

for (const file of files) {
  const errors: string[] = [];
  let entry: any;
  try {
    entry = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    errors.push(`не JSON: ${(e as Error).message}`);
  }

  if (entry) {
    if (!validate(entry)) {
      for (const err of validate.errors ?? []) errors.push(`${err.instancePath || "/"} ${err.message}`);
    }
    if (entry.id !== basename(file, ".json")) errors.push(`id "${entry.id}" не совпадает с именем файла`);
    if (ids.has(entry.id)) errors.push(`id "${entry.id}" повторяется`);
    ids.add(entry.id);

    if (typeof entry.prompt === "string" && Array.isArray(entry.variables)) {
      const used = new Set([...entry.prompt.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map((m) => m[1]));
      const declared = new Set(entry.variables.map((v: { name: string }) => v.name));
      for (const name of used) if (!declared.has(name)) errors.push(`{${name}} есть в промте, но не объявлена в variables`);
      for (const name of declared) if (!used.has(name)) errors.push(`переменная "${name}" объявлена, но не используется в промте`);
      for (const v of entry.variables) {
        if (v.options && !v.options.includes(v.default)) errors.push(`default "${v.default}" переменной "${v.name}" нет среди options`);
      }
    }

    for (const path of [entry.example?.dark, entry.example?.light]) {
      if (path && !existsSync(join(ROOT, "public", path))) errors.push(`нет файла примера public/${path}`);
    }
  }

  if (errors.length) {
    failed++;
    console.log(`✗ ${file}`);
    for (const e of errors) console.log(`    ${e}`);
  } else {
    console.log(`✓ ${file}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} записей в порядке`);
if (failed || files.length === 0) process.exit(1);
