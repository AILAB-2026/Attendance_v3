export const getTokenFromHeader = (req) => {
  try {
    const headers = (req && req.headers) || {};

    // 1) Authorization header (case-insensitive)
    const authHeader = headers["authorization"] || headers["Authorization"];
    if (authHeader) {
      if (typeof authHeader === "string") {
        const parts = authHeader.trim().split(" ");
        // Format: "Bearer <token>"
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          return parts[1];
        }
        // Some clients may send just the raw token without the Bearer prefix
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(authHeader.trim())) {
          return authHeader.trim();
        }
      }
    }

    // 2) Alternate header names occasionally used by clients
    const altHeaderToken =
      headers["x-access-token"] ||
      headers["x-auth-token"] ||
      headers["x-session-token"] ||
      headers["session-token"] ||
      headers["token"] ||
      headers["sessiontoken"]; // Note: header keys are lowercased by Node
    if (altHeaderToken) {
      return Array.isArray(altHeaderToken) ? altHeaderToken[0] : altHeaderToken;
    }

    // 2b) As a last resort, scan all header values for a JWT-looking token
    const headerValues = Object.values(headers);
    for (const v of headerValues) {
      if (typeof v === "string" && /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(v.trim())) {
        return v.trim();
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" && /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(item.trim())) {
            return item.trim();
          }
        }
      }
    }

    // 3) Query parameters (GET): ?token= or ?sessionToken=
    const q = req.query || {};
    if (q.token) return q.token;
    if (q.sessionToken) return q.sessionToken;

    // 4) Body (POST/PUT): token or sessionToken
    const b = req.body || {};
    if (b.token) return b.token;
    if (b.sessionToken) return b.sessionToken;

    return null;
  } catch (e) {
    return null;
  }
};
