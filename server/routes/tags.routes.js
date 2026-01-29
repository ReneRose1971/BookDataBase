import { Router } from "express";
import { getTags, createTag, updateTag, deleteTag } from "../controllers/tags.controller.js";

const router = Router();

router.get('/api/tags', getTags);
router.post('/api/tags', createTag);
router.put('/api/tags/:id', updateTag);
router.delete('/api/tags/:id', deleteTag);

export default router;
