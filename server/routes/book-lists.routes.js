import { Router } from "express";
import {
    getBookLists,
    getBookList,
    createBookList,
    updateBookList,
    deleteBookList
} from "../controllers/book-lists.controller.js";

const router = Router();

router.get('/api/book-lists', getBookLists);
router.get('/api/book-lists/:id', getBookList);
router.post('/api/book-lists', createBookList);
router.put('/api/book-lists/:id', updateBookList);
router.delete('/api/book-lists/:id', deleteBookList);

export default router;
