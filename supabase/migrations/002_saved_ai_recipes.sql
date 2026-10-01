begin;

create table public.saved_ai_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid not null,
  original_meal_id text not null,
  original_title text not null,
  situation text not null,
  minutes smallint not null,
  people smallint not null,
  goal text not null,
  ai_text text not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint saved_ai_recipes_user_generation_unique
    unique (user_id, generation_id),

  constraint saved_ai_recipes_meal_id_valid
    check (original_meal_id ~ '^[0-9]{1,10}$'),

  constraint saved_ai_recipes_title_not_empty
    check (original_title ~ '[^[:space:]]'),

  constraint saved_ai_recipes_situation_valid
    check (char_length(situation) between 1 and 2000
      and situation ~ '[^[:space:]]'),

  constraint saved_ai_recipes_minutes_valid
    check (minutes in (15, 30, 60)),

  constraint saved_ai_recipes_people_valid
    check (people in (1, 2, 4)),

  constraint saved_ai_recipes_goal_valid
    check (goal in ('simpler', 'cheaper', 'healthier', 'original')),

  constraint saved_ai_recipes_text_valid
    check (char_length(ai_text) between 1 and 100000
      and ai_text ~ '[^[:space:]]')
);

alter table public.saved_ai_recipes enable row level security;

revoke all on table public.saved_ai_recipes from public, anon, authenticated;

grant select, insert, delete
  on table public.saved_ai_recipes
  to authenticated;

create policy "Users can read their saved AI recipes"
  on public.saved_ai_recipes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save their own AI recipes"
  on public.saved_ai_recipes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their saved AI recipes"
  on public.saved_ai_recipes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index saved_ai_recipes_user_created_at_idx
  on public.saved_ai_recipes (user_id, created_at desc);

commit;
