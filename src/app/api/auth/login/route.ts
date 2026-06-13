import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE, type SessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body as Record<string, string>;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, password_hash')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 });
  }

  const sessionUser: SessionUser = { id: user.id, name: user.name, email: user.email };
  const token = await signToken(sessionUser);

  const response = NextResponse.json({ user: sessionUser });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
