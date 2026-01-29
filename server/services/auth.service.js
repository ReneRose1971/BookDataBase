import { Client } from "pg";

export async function testLogin({ user, password, host, port, database }) {
    const client = new Client({
        host,
        port,
        database,
        user,
        password
    });

    try {
        await client.connect();
        await client.query("SELECT 1 AS ok");
        return { ok: true };
    } catch (error) {
        return { ok: false, message: error.message };
    } finally {
        await client.end();
    }
}
