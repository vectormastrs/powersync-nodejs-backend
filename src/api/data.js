import express from "express";
import pg from "pg";
import config from "../../config.js";

const {Pool} = pg;

const router = express.Router();

const pool = new Pool({
    host: config.database.host,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    port: config.database.port
});

/**
 * Handle error events for PostgresSQL
 */
pool.on('error', (err, client) => {
    console.error("Pool connection failure to postgres:", err, client);
})

/**
 * Handle all PUT events sent to the server by the client PowerSync application
 */
router.put("/", async (req, res) => {
    if(!req.body) {
        res.status(400).send({
            message: "Invalid body provided"
        });
        return;
    }
    await upsert(req.body, res);
});

/**
 * Handle all PATCH events sent to the server by the client PowerSync application
 */
router.patch("/", async (req, res) => {
    if(!req.body) {
        res.status(400).send({
            message: "Invalid body provided"
        });
        return;
    }
    await upsert(req.body, res);
});

/**
 * Handle all DELETE events sent to the server by the client PowerSync application
 */
router.delete("/", async (req, res) => {
    if(!req.body) {
        res.status(400).send({
            message: "Invalid body provided"
        });
        return;
    }

    // The table which needs to be updated
    const table = req.body.table;
    // The data of the object
    const data = req.body.data;

    console.log(table, data);

    const client = await pool.connect();
    await client.query(`DELETE FROM ${table} WHERE id = $1`, [data.id]);
    await client.release();

    res.status(200).send({
        message: `DELETE completed for ${table} ${data.id}`
    })
});

/**
 * Upsert a row in a table based on the data sent from the PowerSync client. This works out of the box with the PowerSync Todolist Demo apps
 * Make sure to update the function to write to your specific tables in the Postgres database.
 * @param body
 * @param res
 * @returns {Promise<void>}
 */
const upsert = async (body, res) => {
    try {
        // This is the table where the updates should be sent to
        const table = body.table;

        // This is the data for the row
        const row = body.data;

        let text = null;
        let values = [];

        switch (table) {
            case 'lists':
                text = 'INSERT INTO lists(id, created_at, name, owner_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at, name = EXCLUDED.name, owner_id = EXCLUDED.owner_id';
                values = [row.id, row.created_at, row.name, row.owner_id];
                break;
            case 'todos':
                text = 'INSERT INTO todos(id, completed_at, description, completed, created_by, completed_by, list_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET completed_at = EXCLUDED.completed_at, completed = EXCLUDED.completed, completed_by = EXCLUDED.completed_by';
                values = [row.id, row.completed_at, row.description, row.completed, row.created_by, row.completed_by, row.list_id];
                break;
            default:
                break;
        }
        if (text && values.length > 0) {
            const client = await pool.connect();
            await client.query(text, values);
            await client.release();
            res.status(200).send({
                message: `PUT completed for ${table} ${row.id}`
            });
        } else {
            res.status(400).send({
                message: "Invalid body provided, expected table and data"
            });
        }
    } catch (ex) {
        console.log(ex);
        res.status(500).send({
            message: ex.message
        });
    }
}

export { router as dataRouter };
