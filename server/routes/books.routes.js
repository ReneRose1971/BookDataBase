import { Router } from "express";
import {
    getBooks,
    checkDuplicate,
    createBook,
    getBookById,
    updateBook,
    deleteBook,
    generateBookSummary
} from "../controllers/books.controller.js";

const router = Router();

router.get('/api/books', getBooks);
router.get('/api/books/check-duplicate', checkDuplicate);
router.post('/api/books', createBook);
router.get('/api/books/:id', getBookById);
router.put('/api/books/:id', updateBook);
router.post('/api/books/:id/summary', generateBookSummary);
router.delete('/api/books/:id', deleteBook);

export default router;
