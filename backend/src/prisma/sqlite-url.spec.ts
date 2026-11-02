import * as path from 'path';
import { resolveSqliteFileUrl } from './sqlite-url';

describe('resolveSqliteFileUrl', () => {
  it('leaves non-file URLs unchanged', () => {
    expect(resolveSqliteFileUrl('postgresql://x')).toBe('postgresql://x');
  });

  it('leaves already-absolute file URLs unchanged', () => {
    const abs = 'file:C:/data/dev.db';
    expect(resolveSqliteFileUrl(abs)).toBe(abs);
  });

  it('resolves relative sqlite paths to an existing prisma/dev.db when present', () => {
    const resolved = resolveSqliteFileUrl('file:./dev.db');
    if (!resolved) {
      fail('expected a url');
      return;
    }
    expect(resolved.startsWith('file:')).toBe(true);
    expect(resolved.includes('localhost')).toBe(false);
    const filePath = resolved.slice('file:'.length);
    expect(path.basename(filePath)).toBe('dev.db');
  });
});
