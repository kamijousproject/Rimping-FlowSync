import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query, exec } from "./db";

const COOKIE_NAME = "flowsync_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: "admin" | "staff";
};

export type DbUser = SessionUser & { password_hash: string };

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findUserByLogin(login: string): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    "SELECT id, username, email, full_name, role, password_hash FROM users WHERE username=? OR email=? LIMIT 1",
    [login, login]
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: "admin" | "staff";
}): Promise<number> {
  const password_hash = await hashPassword(input.password);
  const res = await exec(
    "INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?,?,?,?,?)",
    [
      input.username,
      input.email,
      password_hash,
      input.full_name,
      input.role || "staff",
    ]
  );
  return res.insertId;
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function readSessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as number,
      username: payload.username as string,
      email: payload.email as string,
      full_name: payload.full_name as string,
      role: payload.role as "admin" | "staff",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
