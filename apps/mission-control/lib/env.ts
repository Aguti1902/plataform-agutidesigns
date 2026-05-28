function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia apps/mission-control/.env.example a .env.local y rellénala.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  basicAuthUser: process.env.BASIC_AUTH_USER ?? '',
  basicAuthPassword: process.env.BASIC_AUTH_PASSWORD ?? '',
};
