import { Router } from "express";
import { getApp, getAuthors } from "../controllers/views.controller.js";

const router = Router();

router.get('/', getApp);
router.get('/app', getApp);
router.get('/authors', getAuthors);

export default router;
