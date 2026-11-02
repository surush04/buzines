import { buildCorsOriginChecker, parseExtraOrigins } from './cors-origins';

describe('CORS origins', () => {
  const allow = buildCorsOriginChecker('https://app.vercel.app', parseExtraOrigins('https://custom.example'));

  it('allows configured frontend and extra origins', () => {
    expect(allow('https://app.vercel.app')).toBe(true);
    expect(allow('https://custom.example')).toBe(true);
  });

  it('allows vercel.app preview hosts and local dev', () => {
    expect(allow('https://foo.vercel.app')).toBe(true);
    expect(allow('http://localhost:4201')).toBe(true);
  });

  it('rejects arbitrary sites', () => {
    expect(allow('https://evil.example')).toBe(false);
  });
});
