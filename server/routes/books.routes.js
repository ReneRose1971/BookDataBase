import { Router } from "express";
import {
    getBooks,
    checkDuplicate,
    createBook,
    getBookById,
    updateBook,
    deleteBook
} from "../controllers/books.controller.js";

const router = Router();

router.get('/api/books', getBooks);
router.get('/api/books/check-duplicate', checkDuplicate);
router.post('/api/books', createBook);
router.get('/api/books/:id', getBookById);
router.put('/api/books/:id', updateBook);
router.delete('/api/books/:id', deleteBook);

export default router;
