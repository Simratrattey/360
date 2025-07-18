import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};