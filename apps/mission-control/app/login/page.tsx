import { LoginForm } from './login-form';

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Mission Control</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Accede con tu email. Te enviaremos un enlace de un solo uso.
        </p>

        {error === 'forbidden' && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Tu cuenta no tiene rol <code>admin</code>. Contacta con el administrador.
          </div>
        )}

        <LoginForm next={next} />
      </div>
    </main>
  );
}
