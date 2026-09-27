import {readFile} from 'node:fs/promises';
import {getPool} from '../database/connection.mjs';
const pool=getPool();
try{await pool.query(await readFile(new URL('../database/sfis-schema.sql',import.meta.url),'utf8'));console.log('SFIS schema ready. Genesis tables unchanged.');}catch{console.error('Database setup failed. Check the connection and schema permissions.');process.exitCode=1;}finally{await pool.end();}
