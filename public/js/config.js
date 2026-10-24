// URL et clé anon publique du projet Supabase.
// Laissez les chaînes vides pour le mode démonstration dans le navigateur.
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export function supabaseConfigure() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
