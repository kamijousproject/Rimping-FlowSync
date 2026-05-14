import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query, exec } from "./db";

const COOKIE_NAME = "fs_session";
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
  role: "admin" | "super_admin";
};

export type DbUser = SessionUser & { password_hash: string };

export function isSuperAdmin(user: { role: string } | null | undefined): boolean {
  return !!user && user.role === "super_admin";
}

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

export type UserWithTempGrant = Pick<SessionUser, "id" | "full_name" | "username" | "email" | "role"> & {
  created_at: Date;
  temp_role: string | null;
  temp_expires_at: string | null;
  temp_granted_by_name: string | null;
};

export async function listUsers(): Promise<UserWithTempGrant[]> {
  return query(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.created_at,
      tg.granted_role AS temp_role,
      tg.expires_at AS temp_expires_at,
      gb.full_name AS temp_granted_by_name
    FROM users u
    LEFT JOIN temp_role_grants tg ON tg.user_id = u.id AND tg.expires_at > NOW()
    LEFT JOIN users gb ON gb.id = tg.granted_by
    ORDER BY u.id ASC
  `);
}

export async function getUserById(id: number): Promise<Pick<SessionUser, "id" | "full_name" | "username"> | null> {
  const rows = await query<Pick<SessionUser, "id" | "full_name" | "username">>(
    "SELECT id, full_name, username FROM users WHERE id=? LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: "admin" | "super_admin";
}): Promise<number> {
  const password_hash = await hashPassword(input.password);
  const res = await exec(
    "INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?,?,?,?,?)",
    [
      input.username,
      input.email,
      password_hash,
      input.full_name,
      input.role || "admin",
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
      role: payload.role as "admin" | "super_admin",
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
  const user = await readSessionToken(token);
  if (!user) return null;
  if (user.role === "super_admin") return user;
  // Check temp role grant
  const grants = await query<{ granted_role: string }>(
    "SELECT granted_role FROM temp_role_grants WHERE user_id=? AND expires_at > NOW() LIMIT 1",
    [user.id]
  ).catch(() => []);
  if (grants.length > 0) {
    return { ...user, role: grants[0].granted_role as "super_admin" };
  }
  return user;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
