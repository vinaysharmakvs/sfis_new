import {readFile} from 'node:fs/promises';
import {getPool} from '../database/connection.mjs';

const pool=getPool();
try{
 await pool.query(await readFile(new URL('../database/careers-schema.sql',import.meta.url),'utf8'));
 console.log('Careers application tables are ready. Existing admissions and booking entries were not modified.');
}catch(error){
 console.error('Careers database setup failed. Check that the SFIS database has the existing booking schema and that this account can create tables.');
 console.error(error.code||error.name);
 process.exitCode=1;
}finally{await pool.end();}
