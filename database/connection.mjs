import pg from 'pg';
let pool;
export function getPool(){
 const connectionString=process.env.DATABASE_URL||process.env.POSTGRES_URL;
 if(!connectionString)throw new Error('DATABASE_NOT_CONFIGURED');
 if(!pool){const url=new URL(connectionString);if(!['localhost','127.0.0.1'].includes(url.hostname))url.searchParams.set('sslmode','verify-full');pool=new pg.Pool({connectionString:url.toString(),max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:10000});}
 return pool;
}
