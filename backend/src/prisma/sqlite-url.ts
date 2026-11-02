import { existsSync } from 'fs';
import * as path from 'path';

/** Resolve SQLite file: URLs to an absolute path without moving or creating a new DB. */
export function resolveSqliteFileUrl(raw: string | undefined): string | undefined {
  if (!raw || !raw.startsWith('file:')) return raw;
  const withoutScheme = raw.slice('file:'.length);
  if (path.isAbsolute(withoutScheme)) return raw;

  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, withoutScheme),
    path.resolve(cwd, 'prisma', path.basename(withoutScheme)),
    path.resolve(__dirname, '..', '..', 'prisma', 'dev.db'),
  ];
  const existing = candidates.find((p) => existsSync(p));
  if (!existing) return raw;
  return `file:${existing.replace(/\\/g, '/')}`;
}
