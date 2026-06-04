import { NextResponse } from 'next/server';

export async function GET() {
  const envKeys = Object.keys(process.env);
  
  const neonDbUrl = process.env.NEON_DATABASE_URL;
  const dbUrl = process.env.DATABASE_URL;
  const postgresUrl = process.env.POSTGRES_URL;

  const maskUrl = (url: string | undefined) => {
    if (!url) return 'undefined';
    try {
      const parsed = new URL(url);
      parsed.password = '***';
      return parsed.toString();
    } catch {
      // If it's not a valid URL structure
      return url.substring(0, 15) + '... (length: ' + url.length + ')';
    }
  };

  const selectedKeys = envKeys.filter(k => 
    k.includes('DATABASE') || 
    k.includes('POSTGRES') || 
    k.includes('DB_') || 
    k.includes('NEON')
  );

  return NextResponse.json({
    neonDatabaseUrlExists: !!neonDbUrl,
    databaseUrlExists: !!dbUrl,
    postgresUrlExists: !!postgresUrl,
    maskedNeonDatabaseUrl: maskUrl(neonDbUrl),
    maskedDatabaseUrl: maskUrl(dbUrl),
    maskedPostgresUrl: maskUrl(postgresUrl),
    availableKeys: selectedKeys,
    nodeEnv: process.env.NODE_ENV
  });
}
