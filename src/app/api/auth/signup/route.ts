import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/server/db';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    name?: string;
    password?: string;
  };

  const email = body.email?.toLowerCase().trim();
  const name = body.name?.trim();
  const password = body.password ?? '';

  if (!email || !name || password.length < 8) {
    return NextResponse.json(
      { error: 'Invalid input.' },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Email already in use.' },
      { status: 409 },
    );
  }

  const passwordHash = await hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  return NextResponse.json({ ok: true });
}
