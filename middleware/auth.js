const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied. Terminal Unlinked.' });
    try {
        const token = authHeader.replace('Bearer ', '');
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Grid Token.' }); }
};

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                msg: `Clearance Denied. Access restricted to: ${allowedRoles.join(' or ').toUpperCase()}.` 
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    authenticate,
    requireRole
};
