import { SignJWT } from "jose";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "denac-default-secret-change-in-production"
);

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const validUsername = process.env.ADMIN_USERNAME ?? "admin";
  const validPassword = process.env.ADMIN_PASSWORD ?? "denac2024";

  if (username !== validUsername || password !== validPassword) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await new SignJWT({ sub: username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);

  const response = Response.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `denac_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${8 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return response;
}
