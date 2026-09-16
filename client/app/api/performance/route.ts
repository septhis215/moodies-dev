import { NextResponse } from "next/server";

const MAX_BODY_LENGTH = 2048;

export async function POST(request: Request) {
  if (process.env.PERFORMANCE_LOGGING !== "true") {
    return new NextResponse(null, { status: 204 });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: "Metric payload is too large." }, { status: 413 });
  }

  try {
    const metric = JSON.parse(body) as Record<string, unknown>;
    if (
      typeof metric.name !== "string" ||
      typeof metric.value !== "number" ||
      !Number.isFinite(metric.value) ||
      metric.value < 0 ||
      typeof metric.path !== "string" ||
      !metric.path.startsWith("/")
    ) {
      return NextResponse.json({ error: "Invalid metric." }, { status: 400 });
    }

    console.info("[performance]", {
      name: metric.name.slice(0, 32),
      value: metric.value,
      path: metric.path.slice(0, 200),
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid metric payload." }, { status: 400 });
  }
}
