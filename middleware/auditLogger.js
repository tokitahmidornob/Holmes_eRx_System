const crypto = require('crypto');
const { AuditEvent } = require('../models/GridModels');

/**
 * 🔒 THE PROVENANCE SEALER
 * Generates a SHA-256 hash of the audit data to ensure immutability.
 */
const generateProvenanceHash = (data) => {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
};

/**
 * 🛰️ THE GLOBAL AUDIT MIDDLEWARE
 * This function is manually called in sensitive routes to capture
 * the 'Who, What, Where, and When'.
 */
const logAudit = async (req, res, next) => {
    // We override the res.send to capture the outcome after the route finishes
    const oldSend = res.send;

    res.send = function (data) {
        // Only log write operations or failed access attempts for high efficiency
        if (req.method !== 'GET' || res.statusCode >= 400) {
            
            const auditData = {
                actorId: req.user ? req.user.id : null, // Captured from JWT
                actionType: `${req.method}_${req.originalUrl}`,
                resourceType: req.baseUrl.split('/').pop(),
                ipAddress: req.ip || req.connection.remoteAddress,
                deviceMetadata: req.headers['user-agent'],
                outcome: res.statusCode < 400 ? 'Success' : 'Failure',
                timestamp: new Date().toISOString()
            };

            // Seal the record cryptographically
            const provenanceHash = generateProvenanceHash(auditData);

            // Fire and forget the log to the Capped Collection (won't slow down the UI)
            AuditEvent.create({
                ...auditData,
                provenanceHash
            }).catch(err => console.error("CRITICAL: Audit Log Failed", err));
        }

        oldSend.apply(res, arguments);
    };

    next();
};

module.exports = { logAudit };