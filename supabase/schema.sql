-- MediVoix — schéma à coller une fois dans l'éditeur SQL d'un projet Supabase vide.
-- Authentication : désactiver la confirmation par e-mail pour la démonstration.
-- Aucune clé secrète ici. La clé service_role ne doit jamais être dans le dépôt.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.nouveau_jeton()
returns text
language sql
volatile
as $$
  select substr(
    translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', 'xyz'),
    1,
    22
  );
$$;

create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('medecin', 'infirmier', 'patient')),
  nom_affichage text not null default '',
  doit_changer_identifiants boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profils is 'Un profil par compte : médecin, infirmier ou patient.';

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profils (id),
  user_id uuid unique references public.profils (id) on delete set null,
  identifiant text unique,
  qr_token text unique not null default public.nouveau_jeton(),
  nom_complet text not null check (char_length(btrim(nom_complet)) > 0),
  sexe text check (sexe in ('M', 'F')),
  date_naissance date,
  telephone text default '',
  adresse text default '',
  groupe_sanguin text check (
    groupe_sanguin is null
    or groupe_sanguin in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  ),
  antecedents jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (identifiant is null or identifiant ~ '^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])$'),
  check (char_length(qr_token) >= 16)
);

comment on table public.patients is 'Fiche patient de la clinique. Le QR code ne contient que qr_token.';

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  medecin_id uuid not null references public.profils (id),
  dictee text default '',
  dossier jsonb,
  duree_secondes integer,
  valide boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.consultations is 'Dictée, dossier structuré, durée et état brouillon ou validé.';

create table if not exists public.journal_acces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profils (id) on delete set null,
  auteur_nom text default '',
  role text not null check (role in ('medecin', 'infirmier', 'patient')),
  patient_id uuid references public.patients (id) on delete set null,
  patient_nom text default '',
  action text not null check (action in ('consultation', 'scan', 'creation', 'modification', 'validation', 'suppression')),
  created_at timestamptz not null default now()
);

comment on table public.journal_acces is 'Journal en ajout seulement : qui a lu quoi, et quand. patient_nom garde le nom après suppression de la fiche.';

create index if not exists consultations_patient_idx on public.consultations (patient_id, created_at desc);
create index if not exists journal_patient_idx on public.journal_acces (patient_id, created_at desc);
create index if not exists journal_created_idx on public.journal_acces (created_at desc);

create or replace function public.est_medecin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profils
    where id = auth.uid() and role = 'medecin'
  );
$$;

create or replace function public.est_infirmier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profils
    where id = auth.uid() and role = 'infirmier'
  );
$$;

create or replace function public.est_soignant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profils
    where id = auth.uid() and role in ('medecin', 'infirmier')
  );
$$;

create or replace function public.role_courant()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profils where id = auth.uid();
$$;

-- Le rôle soignant n'est accepté que si l'inscription vient de l'espace soignant.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := coalesce(new.raw_user_meta_data ->> 'role', '');
  espace text := coalesce(new.raw_user_meta_data ->> 'espace', '');
  nom text := coalesce(new.raw_user_meta_data ->> 'nom_affichage', '');
  role_final text := 'patient';
begin
  if espace = 'soignant' and meta_role in ('medecin', 'infirmier') then
    role_final := meta_role;
  end if;
  insert into public.profils (id, role, nom_affichage, doit_changer_identifiants)
  values (new.id, role_final, nom, role_final = 'patient')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protege_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.role := old.role;
  new.created_at := old.created_at;
  new.id := old.id;
  return new;
end;
$$;

drop trigger if exists profils_protege on public.profils;
create trigger profils_protege
  before update on public.profils
  for each row execute function public.protege_profil();

create or replace function public.protege_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.est_medecin() then
    new.updated_at := now();
    return new;
  end if;
  if auth.uid() is not null and auth.uid() = old.user_id then
    new.id := old.id;
    new.created_by := old.created_by;
    new.user_id := old.user_id;
    new.qr_token := old.qr_token;
    new.nom_complet := old.nom_complet;
    new.sexe := old.sexe;
    new.date_naissance := old.date_naissance;
    new.groupe_sanguin := old.groupe_sanguin;
    new.antecedents := old.antecedents;
    new.created_at := old.created_at;
    new.updated_at := now();
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists patients_protege on public.patients;
create trigger patients_protege
  before update on public.patients
  for each row execute function public.protege_patient();

alter table public.profils enable row level security;
alter table public.patients enable row level security;
alter table public.consultations enable row level security;
alter table public.journal_acces enable row level security;

drop policy if exists profils_lecture on public.profils;
create policy profils_lecture on public.profils
  for select to authenticated
  using (id = auth.uid() or public.est_soignant());

drop policy if exists profils_maj on public.profils;
create policy profils_maj on public.profils
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists patients_lecture on public.patients;
create policy patients_lecture on public.patients
  for select to authenticated
  using (public.est_medecin() or public.est_infirmier() or user_id = auth.uid());

drop policy if exists patients_creation on public.patients;
create policy patients_creation on public.patients
  for insert to authenticated
  with check (public.est_medecin() and created_by = auth.uid());

drop policy if exists patients_maj on public.patients;
create policy patients_maj on public.patients
  for update to authenticated
  using (public.est_medecin() or user_id = auth.uid())
  with check (public.est_medecin() or user_id = auth.uid());

drop policy if exists patients_suppression on public.patients;
create policy patients_suppression on public.patients
  for delete to authenticated
  using (public.est_medecin());

drop policy if exists consultations_lecture on public.consultations;
create policy consultations_lecture on public.consultations
  for select to authenticated
  using (
    public.est_medecin()
    or (public.est_infirmier() and valide = true)
    or (
      valide = true
      and exists (
        select 1 from public.patients p
        where p.id = consultations.patient_id and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists consultations_creation on public.consultations;
create policy consultations_creation on public.consultations
  for insert to authenticated
  with check (public.est_medecin() and medecin_id = auth.uid());

drop policy if exists consultations_maj on public.consultations;
create policy consultations_maj on public.consultations
  for update to authenticated
  using (public.est_medecin())
  with check (public.est_medecin());

drop policy if exists consultations_suppression on public.consultations;
create policy consultations_suppression on public.consultations
  for delete to authenticated
  using (public.est_medecin());

drop policy if exists journal_ajout on public.journal_acces;
create policy journal_ajout on public.journal_acces
  for insert to authenticated
  with check (
    public.est_soignant()
    and user_id = auth.uid()
    and role = public.role_courant()
  );

drop policy if exists journal_lecture on public.journal_acces;
create policy journal_lecture on public.journal_acces
  for select to authenticated
  using (public.est_medecin());

revoke all on table public.profils from anon, public;
revoke all on table public.patients from anon, public;
revoke all on table public.consultations from anon, public;
revoke all on table public.journal_acces from anon, public;

grant select, update on table public.profils to authenticated;
grant select, insert, update, delete on table public.patients to authenticated;
grant select, insert, update, delete on table public.consultations to authenticated;
grant select, insert on table public.journal_acces to authenticated;

revoke all on function public.est_medecin() from public, anon;
revoke all on function public.est_infirmier() from public, anon;
revoke all on function public.est_soignant() from public, anon;
revoke all on function public.role_courant() from public, anon;
revoke all on function public.nouveau_jeton() from public, anon;
revoke all on function public.handle_new_user() from public, anon;
revoke all on function public.protege_profil() from public, anon;
revoke all on function public.protege_patient() from public, anon;

grant execute on function public.est_medecin() to authenticated;
grant execute on function public.est_infirmier() to authenticated;
grant execute on function public.est_soignant() to authenticated;
grant execute on function public.role_courant() to authenticated;
grant execute on function public.nouveau_jeton() to authenticated;
