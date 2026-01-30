import express from "express";
import multer from "multer";
import {
    extractCoverScan,
    getCoverScanConfigEndpoint,
    importCoverScan
} from "../controllers/cover-scan.controller.js";
import { getCoverScanConfig } from "../services/cover-scan.service.js";

const router = express.Router();
const config = getCoverScanConfig();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: config.maxFiles }
});

router.get("/api/cover-scan/config", getCoverScanConfigEndpoint);
router.post("/api/cover-scan/extract", upload.array("files", config.maxFiles), extractCoverScan);
router.post("/api/cover-scan/import", importCoverScan);

router.use((err, req, res, next) => {
    if (err?.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: `Maximal ${config.maxFiles} Dateien erlaubt.` });
    }
    return next(err);
});

export default router;
