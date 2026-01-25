import { Router } from "express";
import {
    getApiStatus,
    saveOpenAiKey,
    saveOpenLibraryKey,
    saveGoogleBooksKey,
    deleteOpenAiKey,
    deleteOpenLibraryKey,
    deleteGoogleBooksKey
} from "../controllers/config.controller.js";

const router = Router();

router.get('/api/config/apis', getApiStatus);
router.post('/api/config/apis/openai', saveOpenAiKey);
router.post('/api/config/apis/openlibrary', saveOpenLibraryKey);
router.post('/api/config/apis/google-books', saveGoogleBooksKey);
router.delete('/api/config/apis/openai', deleteOpenAiKey);
router.delete('/api/config/apis/openlibrary', deleteOpenLibraryKey);
router.delete('/api/config/apis/google-books', deleteGoogleBooksKey);

export default router;
