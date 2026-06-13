import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE, type SessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { name, email, password } = body as Record<string, string>;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ name, email: email.toLowerCase(), password_hash })
    .select('id, name, email')
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 });
  }

  const sessionUser: SessionUser = { id: user.id, name: user.name, email: user.email };
  const token = await signToken(sessionUser);

  const response = NextResponse.json({ user: sessionUser }, { status: 201 });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
