/**
 * Falla si algún archivo del repositorio contiene el guion largo (U+2014). El carácter se arma
 * con su código para que este archivo tampoco lo contenga.
 * Uso: npm run check:emdash
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EM_DASH = String.fromCharCode(0x2014);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/\.(png|jpe?g|pdf|woff2?|ico)$/i.test(f) && f !== 'package-lock.json');

const hits: string[] = [];
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    if (line.includes(EM_DASH)) hits.push(`${file}:${i + 1}`);
  });
}

if (hits.length) {
  console.error(`Guion largo (U+2014) encontrado en:\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log(`Sin guiones largos en ${files.length} archivos.`);
