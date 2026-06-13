'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError('Email ou senha inválidos');
        return;
      }

      router.push('/matches');
    } catch (error) {
      setError('Erro na conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="elevated" className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-green mb-2">WorldCupBets</h1>
        <p className="text-secondary">Faça seu login</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-900 border border-red-700 rounded-lg text-red-100 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="seu@email.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <Input
          label="Senha"
          type="password"
          placeholder="Sua senha"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          required
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="lg"
          loading={loading}
        >
          Entrar
        </Button>
      </form>

      <div className="text-center">
        <p className="text-secondary">
          Não tem conta?{' '}
          <Link
            href="/register"
            className="text-brand-green hover:text-brand-yellow transition-colors"
          >
            Cadastre-se
          </Link>
        </p>
      </div>
    </Card>
  );
}
