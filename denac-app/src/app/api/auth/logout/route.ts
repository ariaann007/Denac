export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    "denac_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );
  return response;
}
