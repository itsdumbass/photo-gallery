export async function requireUser(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: Response.json({ error: "Not logged in" }, { status: 401 }) };
  }

  const idToken = authHeader.replace("Bearer ", "");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.users || data.users.length === 0) {
    return { error: Response.json({ error: "Invalid login" }, { status: 401 }) };
  }

  return {
    user: {
      id: data.users[0].localId,
      email: data.users[0].email,
    },
  };
}