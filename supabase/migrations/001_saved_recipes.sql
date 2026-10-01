begin;

create table public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null,
  title text not null,
  image_url text not null,
  created_at timestamptz not null default now(),

  constraint saved_recipes_user_meal_unique
    unique (user_id, meal_id),

  constraint saved_recipes_meal_id_valid
    check (meal_id ~ '^[0-9]{1,10}$'),

  constraint saved_recipes_title_not_empty
    check (length(trim(title)) > 0)
);

alter table public.saved_recipes enable row level security;

revoke all on table public.saved_recipes from public, anon, authenticated;

grant select, insert, delete
  on table public.saved_recipes
  to authenticated;

create policy "Users can read their saved recipes"
  on public.saved_recipes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save their own recipes"
  on public.saved_recipes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their saved recipes"
  on public.saved_recipes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
