import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type OperatorLoginPageProps = {
  onLogin: (code: string) => Promise<void>;
};

function formatCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
    .replace(/(.{4})(?=.)/g, '$1-');
}

export function OperatorLoginPage({ onLogin }: OperatorLoginPageProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.replace(/-/g, '');
    if (normalizedCode.length !== 12) {
      setError('Digite o código temporário completo.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onLogin(normalizedCode);
    } catch {
      setError('Código inválido, já utilizado ou expirado.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-brand-line">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-brand-tint text-primary">
            <KeyRound aria-hidden="true" />
          </div>
          <CardTitle className="t-section">Operador de pista</CardTitle>
          <CardDescription>
            Use o código temporário fornecido pelo escritório para este remate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label className="t-label" htmlFor="operator-code">
                Código temporário
              </label>
              <Input
                id="operator-code"
                value={code}
                onChange={(event) => setCode(formatCode(event.target.value))}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="one-time-code"
                inputMode="text"
                className="h-12 text-center font-mono text-lg tracking-[0.12em]"
                autoFocus
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Validando…' : 'Entrar como operador'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
