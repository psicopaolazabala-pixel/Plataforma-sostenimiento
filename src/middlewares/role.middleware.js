export function requireRole(roleRequired) {
  return (req, res, next) => {
    if (!req.user || req.user.rol !== roleRequired) {
      return res.status(403).json({ error: `Acceso prohibido. Requiere rol de: ${roleRequired}` });
    }
    next();
  };
}