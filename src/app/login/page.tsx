import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <h1
            className="text-3xl font-bold text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            RPG do Axel
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isSignup
              ? "Crie sua conta de aventureiro"
              : "Entre para a mesa"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <form className="space-y-4">
          {isSignup && (
            <div>
              <label className="label" htmlFor="display_name">
                Nome de exibição
              </label>
              <input
                id="display_name"
                name="display_name"
                required
                placeholder="Ex: Axel, Lyra, Thorin..."
                className="input"
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="voce@email.com"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="input"
            />
          </div>

          <button
            formAction={isSignup ? signup : login}
            className="btn-primary w-full"
          >
            {isSignup ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? (
            <>
              Já tem conta?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </>
          ) : (
            <>
              Novo na mesa?{" "}
              <Link
                href="/login?mode=signup"
                className="text-primary hover:underline"
              >
                Criar conta
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
