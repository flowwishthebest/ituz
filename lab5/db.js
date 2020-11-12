const pg = require('pg');

require('dotenv').config();

const pgClient = new pg.Client({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
});

module.exports = {
    client: pgClient,
};
