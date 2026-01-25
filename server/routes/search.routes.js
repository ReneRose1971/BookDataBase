import { Router } from "express";
import {
    searchLocal,
    searchExternal,
    getSearchResults,
    importAuthor,
    importBook
} from "../controllers/search.controller.js";

const router = Router();

router.post("/api/search/local", searchLocal);
router.post("/api/search/external", searchExternal);
router.get("/api/search/results/:id", getSearchResults);
router.post("/api/search/results", getSearchResults);
router.post("/api/search/import/author", importAuthor);
router.post("/api/search/import/book", importBook);

export default router;
