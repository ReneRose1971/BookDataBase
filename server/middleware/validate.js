export function parseIntParam(req, res, paramName, errorMessage) {
    const value = parseInt(req.params[paramName], 10);
    if (isNaN(value)) {
        res.status(400).json({ error: errorMessage });
        return null;
    }
    return value;
}
