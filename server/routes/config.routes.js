import { Router } from "express";
import {
    getApiStatus,
    saveOpenAiKey,
    saveGoogleBooksKey,
    deleteOpenAiKey,
    deleteGoogleBooksKey,
    getBookSummaryPrompt,
    saveBookSummaryPrompt
} from "../controllers/config.controller.js";

const router = Router();

router.get('/api/config/apis', getApiStatus);
router.post('/api/config/apis/openai', saveOpenAiKey);
router.post('/api/config/apis/googlebooks', saveGoogleBooksKey);
router.delete('/api/config/apis/openai', deleteOpenAiKey);
router.delete('/api/config/apis/googlebooks', deleteGoogleBooksKey);
router.get('/api/config/prompts/book_summary', getBookSummaryPrompt);
router.put('/api/config/prompts/book_summary', saveBookSummaryPrompt);

export default router;
