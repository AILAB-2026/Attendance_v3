import express from "express";
import { logActivity } from "./utils/auditLogger.js";

const router = express.Router();

router.post("/client-log", (req, res) => {
    try {
        const { companyCode, employeeNo, action, message, metadata } = req.body;

        console.log("📝 Received client log:", { companyCode, employeeNo, action, message });

        logActivity(
            req.body.action || "client-log",
            req.body.status || "failure",
            message || "Client reported event",
            {
                companyCode,
                employeeNo,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                ...metadata,
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error("❌ Failed to process client log:", error);
        res.status(500).json({ success: false });
    }
});

export default router;
