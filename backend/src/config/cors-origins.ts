export function parseExtraOrigins(raw?: string): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function buildCorsOriginChecker(
  frontendUrl: string,
  extraOrigins: string[],
): (origin: string) => boolean {
  const allowed = new Set(
    [
      frontendUrl,
      'http://localhost:4200',
      'http://localhost:4201',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:4201',
      ...extraOrigins,
    ].filter(Boolean),
  );

  const patterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https:\/\/[^/]+\.vercel\.app$/,
    /^https:\/\/[^/]+\.onrender\.com$/,
    /^https:\/\/[^/]+\.trycloudflare\.com$/,
  ];

  return (origin: string): boolean => {
    if (allowed.has(origin)) return true;
    return patterns.some((pattern) => pattern.test(origin));
  };
}
