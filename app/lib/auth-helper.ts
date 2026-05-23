export async function generateSessionToken(password: string): Promise<string> {
  const secret = process.env.AUTH_SECRET || "default_fallback_secret";
  const encoder = new TextEncoder();

  const data = encoder.encode(password + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}