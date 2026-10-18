import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED_DATABASE = 'mydb_test_pi2';

function abort(message) {
  console.error(`BLOQUEADO: ${message}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  abort('DATABASE_URL nao configurada.');
}

let url;

try {
  url = new URL(process.env.DATABASE_URL);
} catch {
  abort('DATABASE_URL invalida.');
}

const databaseName = decodeURIComponent(url.pathname.slice(1));

if (databaseName !== EXPECTED_DATABASE) {
  abort(`Banco ${databaseName} nao autorizado para testes.`);
}

if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
  abort('O banco deve utilizar PostgreSQL.');
}

if (process.env.NODE_ENV === 'production') {
  abort('Testes proibidos em ambiente de producao.');
}

const testDirectory = join(process.cwd(), 'tests', 'integration');

let testFiles;

try {
  testFiles = readdirSync(testDirectory)
    .filter((file) => file.endsWith('.test.js'))
    .sort()
    .map((file) => join(testDirectory, file));
} catch {
  abort('Nao foi possivel localizar a pasta de testes.');
}

if (testFiles.length === 0) {
  abort('Nenhum arquivo de teste de integracao encontrado.');
}

console.log(`Banco de testes autorizado: ${databaseName}`);
console.log(`Arquivos de teste encontrados: ${testFiles.length}`);

const result = spawnSync(
  process.execPath,
  ['--test', ...testFiles],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    stdio: 'inherit',
    shell: false,
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
