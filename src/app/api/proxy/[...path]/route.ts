import { NextRequest, NextResponse } from "next/server";

const normalizeBaseUrl = (url: string): string => {
  return url.replace(/\/+$/, "");
};

const backendBaseUrl = normalizeBaseUrl(
  process.env.BACKEND_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:8080",
);

const buildTargetUrl = (request: NextRequest, path: string[]): string => {
  const sanitizedPath = path.map((segment) => segment.replace(/^\/+|\/+$/g, ""));
  const joinedPath = sanitizedPath.join("/");
  const search = request.nextUrl.search || "";
  return `${backendBaseUrl}/${joinedPath}${search}`;
};

const copyRequestHeaders = (request: NextRequest): Headers => {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("origin");
  headers.delete("referer");
  return headers;
};

const copyResponseHeaders = (headers: Headers): Headers => {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("content-encoding");
  nextHeaders.delete("transfer-encoding");
  nextHeaders.delete("connection");
  return nextHeaders;
};

const forwardRequest = async (
  request: NextRequest,
  path: string[],
): Promise<NextResponse> => {
  const method = request.method.toUpperCase();
  const canHaveBody = !["GET", "HEAD"].includes(method);
  const targetUrl = buildTargetUrl(request, path);
  const headers = copyRequestHeaders(request);
  const bodyBuffer = canHaveBody ? await request.arrayBuffer() : null;
  const body =
    bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: copyResponseHeaders(upstreamResponse.headers),
    });
  } catch (error) {
    const details =
      error instanceof Error && error.message
        ? error.message
        : "Backend API khong phan hoi.";

    return NextResponse.json(
      {
        status: 503,
        message: "Khong the ket noi backend API.",
        path: `/${path.join("/")}`,
        details,
      },
      { status: 503 },
    );
  }
};

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}
