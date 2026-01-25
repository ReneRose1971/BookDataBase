import { Router } from "express";
import {
    getAuthors,
    getAuthorById,
    createAuthor,
    updateAuthor,
    deleteAuthor,
    getAuthorBooks
} from "../controllers/authors.controller.js";

const router = Router();

router.get('/api/authors', getAuthors);
router.get('/api/authors/:id', getAuthorById);
router.post('/api/authors', createAuthor);
router.get('/api/authors/:id/books', getAuthorBooks);
router.put('/api/authors/:id', updateAuthor);

console.log("REGISTER DELETE /api/authors/:id");
router.delete('/api/authors/:id', deleteAuthor);

export default router;
