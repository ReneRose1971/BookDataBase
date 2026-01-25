import { Router } from "express";
import {
    getApiStatus,
    saveOpenAiKey,
    saveOpenLibraryKey,
    deleteOpenAiKey,
    deleteOpenLibraryKey
} from "../controllers/config.controller.js";

const router = Router();

router.get('/api/config/apis', getApiStatus);
router.post('/api/config/apis/openai', saveOpenAiKey);
router.post('/api/config/apis/openlibrary', saveOpenLibraryKey);
router.delete('/api/config/apis/openai', deleteOpenAiKey);
router.delete('/api/config/apis/openlibrary', deleteOpenLibraryKey);

export default router;
