import { testLogin } from "../services/auth.service.js";

export async function login(req, res) {
    const { user, password } = req.body;

    const result = await testLogin({
        user,
        password,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME
    });

    if (result.ok) {
        res.status(200).send("DB OK");
    } else {
        res.status(200).send(`DB FAIL: ${result.message}`);
    }
}
