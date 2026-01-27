import { Router } from "express";
import {
    searchLocal,
    searchExternal,
    startExternalSearch,
    getExternalSearchStatus,
    cancelExternalSearch,
    getSearchResults,
    importAuthor,
    importBook
} from "../controllers/search.controller.js";

const router = Router();

router.post("/api/search/local", searchLocal);
router.post("/api/search/external", searchExternal);
router.post("/api/search/external/start", startExternalSearch);
router.get("/api/search/external/status/:searchId", getExternalSearchStatus);
router.post("/api/search/external/cancel/:searchId", cancelExternalSearch);
router.get("/api/search/results/:id", getSearchResults);
router.post("/api/search/results", getSearchResults);
router.post("/api/search/import/author", importAuthor);
router.post("/api/search/import/book", importBook);

export default router;
