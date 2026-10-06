declare global {
  namespace Express {
    interface Request {
      /** Set by the auth middleware for signed-in requests. */
      userId?: string;
    }
  }
}

export {};
