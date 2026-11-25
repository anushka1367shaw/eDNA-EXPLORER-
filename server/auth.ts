import type { Request, Response, NextFunction } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

let cachedProjectId = '';

function loadFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { projectId?: string };
    if (raw.projectId && raw.projectId !== 'remixed-project-id') {
      cachedProjectId = raw.projectId;
      return cachedProjectId;
    }
  }
  return '';
}

function getFirebaseAdminAuth() {
  const projectId = loadFirebaseProjectId();
  if (!projectId) {
    throw new Error('Firebase project configuration is missing or contains placeholder values.');
  }
  const app = getApps().length ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

export function getFirebaseProjectId(): string {
  return loadFirebaseProjectId();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Empty token.' });
    return;
  }

  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const adminEmail = (process.env.ADMIN_EMAIL || 'anushka1367@gmail.com').toLowerCase();
    const tokenEmail = (decoded.email || '').toLowerCase();
    const isAdmin =
      decoded.admin === true ||
      (Boolean(tokenEmail) && tokenEmail === adminEmail && decoded.email_verified === true);

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: Boolean(decoded.email_verified),
      isAdmin,
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Invalid or expired authentication token.',
      detail: err instanceof Error ? err.message : 'Token verification failed',
    });
  }
}

export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!req.user.emailVerified && !req.user.isAdmin) {
    res.status(403).json({
      error: 'Email verification required before uploading or analyzing scientific datasets.',
    });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.isAdmin) {
    res.status(403).json({ error: 'Forbidden. Verified administrator privileges required.' });
    return;
  }
  next();
}
