import { NextRequest, NextResponse } from "next/server";

function isAuthorized(header: string | null, password: string) {
  if (!header?.startsWith("Basic ")) {
    return false;
  }

  try {
    const token = header.slice("Basic ".length);
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const suppliedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
    return suppliedPassword === password;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const password = process.env.STUDY_ACCESS_PASSWORD;

  if (!password || isAuthorized(request.headers.get("authorization"), password)) {
    return NextResponse.next();
  }

  return new NextResponse("Private study space", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Surgery Study", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/:path*"],
};
