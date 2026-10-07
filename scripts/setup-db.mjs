import {readFile} from 'node:fs/promises';
import {getPool} from '../database/connection.mjs';
const pool=getPool();
try{await pool.query(await readFile(new URL('../database/sfis-schema.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../database/bookings-schema.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../database/bookings-approval-schema.sql',import.meta.url),'utf8'));console.log('SFIS schema and booking approvals ready. Existing records preserved.');}catch{console.error('Database setup failed. Check the connection and schema permissions.');process.exitCode=1;}finally{await pool.end();}
