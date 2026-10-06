import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { users, type UserRow } from '../db/schema';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import type { LoginInput, RegisterInput } from '../validators/auth.validators';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt.toISOString() };
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (err as { cause?: { code?: string } } | null)?.cause?.code;
  return code === '23505';
}

// Compared against when the email does not exist, so a wrong email and a wrong
// password take about the same time (prevents guessing which emails are registered).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('vizualizer-timing-placeholder');
  return dummyHashPromise;
}

export async function registerUser(input: RegisterInput) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (existing) {
    throw new ConflictError('An account with this email already exists.', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const [created] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .returning();
    if (!created) throw new Error('User insert returned no row');
    return { user: toPublicUser(created), token: signAccessToken(created.id) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('An account with this email already exists.', 'EMAIL_TAKEN');
    }
    throw err;
  }
}

export async function loginUser(input: LoginInput) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !valid) {
    throw new UnauthorizedError('Incorrect email or password.', 'INVALID_CREDENTIALS');
  }

  return { user: toPublicUser(user), token: signAccessToken(user.id) };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) {
    // The account no longer exists, so the saved session is no longer valid.
    throw new UnauthorizedError('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  return toPublicUser(user);
}

