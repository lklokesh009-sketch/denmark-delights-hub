create type public.app_role as enum ('owner','branch_manager');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  branch int,
  unique (user_id, role, branch)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create or replace function public.can_manage_branch(_user_id uuid, _branch int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and (role='owner' or (role='branch_manager' and branch=_branch)))
$$;

create policy "own roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'owner'));
create policy "owner manages roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));
grant insert, update, delete on public.user_roles to authenticated;

-- first signed-up user becomes owner
create or replace function public.handle_first_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='owner') then
    insert into public.user_roles(user_id, role) values (new.id, 'owner');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_owner after insert on auth.users
  for each row execute function public.handle_first_owner();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  cuisine text not null,
  price numeric(10,2) not null,
  description text,
  available boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "public read menu" on public.menu_items for select to anon, authenticated using (true);
create policy "owner edit menu" on public.menu_items for all to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create table public.bank_details (
  id int primary key default 1 check (id = 1),
  account_name text, account_number text, ifsc text, bank_name text, upi_id text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.bank_details to authenticated;
grant all on public.bank_details to service_role;
alter table public.bank_details enable row level security;
create policy "owner only bank" on public.bank_details for all to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  branch int not null check (branch between 1 and 3),
  customer_name text not null,
  phone text not null,
  address text,
  order_type text not null check (order_type in ('dine_in','delivery')),
  payment_method text not null check (payment_method in ('credit_card','debit_card','net_banking','upi','cash')),
  items jsonb not null,
  total numeric(10,2) not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
grant insert on public.orders to anon, authenticated;
grant select, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "anyone place order" on public.orders for insert to anon, authenticated with check (status = 'new');
create policy "branch staff read" on public.orders for select to authenticated using (public.can_manage_branch(auth.uid(), branch));
create policy "branch staff update" on public.orders for update to authenticated using (public.can_manage_branch(auth.uid(), branch));
create policy "owner delete" on public.orders for delete to authenticated using (public.has_role(auth.uid(),'owner'));
alter publication supabase_realtime add table public.orders;

-- Seed ~100 dishes
insert into public.menu_items(name, category, cuisine, price, sort)
select n, c, cu, p, row_number() over () from (values
('Chicken Shawarma Roll','Shawarma','Arabian',120),('Chicken Shawarma Plate','Shawarma','Arabian',180),('Mutton Shawarma Roll','Shawarma','Arabian',160),('Spicy Shawarma Roll','Shawarma','Arabian',130),('Cheese Shawarma Roll','Shawarma','Arabian',150),('Mexican Shawarma','Shawarma','Arabian',150),('Shawarma Pita Bread','Shawarma','Arabian',140),('Jumbo Shawarma','Shawarma','Arabian',220),
('Al Faham Full','Grills','Arabian',480),('Al Faham Half','Grills','Arabian',260),('Al Faham Quarter','Grills','Arabian',150),('Peri Peri Al Faham Half','Grills','Arabian',280),('Grilled Chicken Full','Grills','Arabian',460),('Grilled Chicken Half','Grills','Arabian',250),('Tandoori Chicken Full','Grills','Arabian',440),('Tandoori Chicken Half','Grills','Arabian',240),('Chicken Tikka','Grills','Arabian',220),('Malai Tikka','Grills','Arabian',240),('Mutton Seekh Kebab','Grills','Arabian',280),('Chicken Seekh Kebab','Grills','Arabian',230),('Fish Tikka','Grills','Arabian',300),('Grilled Prawns','Grills','Arabian',360),
('Chicken Mandi Single','Mandi','Arabian',280),('Chicken Mandi Full','Mandi','Arabian',1050),('Mutton Mandi Single','Mandi','Arabian',380),('Mutton Mandi Full','Mandi','Arabian',1450),('Al Faham Mandi','Mandi','Arabian',320),('Fish Mandi','Mandi','Arabian',350),('Chicken Kabsa','Mandi','Arabian',300),('Mutton Kabsa','Mandi','Arabian',400),('Zurbian Chicken','Mandi','Arabian',320),('Madfoon Mutton','Mandi','Arabian',420),
('Hummus with Pita','Arabian Sides','Arabian',120),('Garlic Toum','Arabian Sides','Arabian',40),('Falafel','Arabian Sides','Arabian',110),('Kubboos (2 pcs)','Arabian Sides','Arabian',30),('Fattoush Salad','Arabian Sides','Arabian',130),('Mutabal','Arabian Sides','Arabian',120),('Chicken Harees','Arabian Sides','Arabian',180),('Lamb Ouzi','Arabian Sides','Arabian',650),
('Chicken Fried Rice','Fried Rice','Chinese',160),('Egg Fried Rice','Fried Rice','Chinese',130),('Mixed Fried Rice','Fried Rice','Chinese',200),('Schezwan Chicken Fried Rice','Fried Rice','Chinese',180),('Prawn Fried Rice','Fried Rice','Chinese',220),('Mutton Fried Rice','Fried Rice','Chinese',230),('Burnt Garlic Chicken Rice','Fried Rice','Chinese',190),('Triple Schezwan Rice','Fried Rice','Chinese',240),
('Chicken Noodles','Noodles','Chinese',160),('Egg Noodles','Noodles','Chinese',130),('Schezwan Chicken Noodles','Noodles','Chinese',180),('Mixed Noodles','Noodles','Chinese',210),('Prawn Noodles','Noodles','Chinese',220),('Chicken Hakka Noodles','Noodles','Chinese',170),('Chilli Garlic Noodles','Noodles','Chinese',170),('Chicken Chopsuey','Noodles','Chinese',220),
('Chilli Chicken Dry','Chinese Starters','Chinese',190),('Chilli Chicken Gravy','Chinese Starters','Chinese',200),('Dragon Chicken','Chinese Starters','Chinese',220),('Chicken 65','Chinese Starters','Chinese',180),('Chicken Lollipop','Chinese Starters','Chinese',200),('Pepper Chicken','Chinese Starters','Chinese',200),('Ginger Chicken','Chinese Starters','Chinese',200),('Garlic Chicken','Chinese Starters','Chinese',200),('Honey Chilli Chicken','Chinese Starters','Chinese',220),('Chicken Manchurian','Chinese Starters','Chinese',200),('Crispy Fried Chicken','Chinese Starters','Chinese',210),('Chilli Fish','Chinese Starters','Chinese',240),('Golden Fried Prawns','Chinese Starters','Chinese',280),('Chilli Prawns','Chinese Starters','Chinese',280),('Szechuan Mutton','Chinese Starters','Chinese',300),('Chilli Egg','Chinese Starters','Chinese',140),
('Hot & Sour Chicken Soup','Soups','Chinese',110),('Sweet Corn Chicken Soup','Soups','Chinese',110),('Manchow Chicken Soup','Soups','Chinese',120),('Lemon Coriander Chicken Soup','Soups','Chinese',120),('Seafood Soup','Soups','Chinese',150),('Mutton Bone Soup','Soups','Chinese',140),
('Chicken Dum Biryani','Biryani','Tamil Special',200),('Mutton Dum Biryani','Biryani','Tamil Special',280),('Ambur Chicken Biryani','Biryani','Tamil Special',210),('Dindigul Mutton Biryani','Biryani','Tamil Special',300),('Egg Biryani','Biryani','Tamil Special',150),('Prawn Biryani','Biryani','Tamil Special',290),('Fish Biryani','Biryani','Tamil Special',270),('Chicken 65 Biryani','Biryani','Tamil Special',230),('Bucket Biryani (Family)','Biryani','Tamil Special',899),('Seeraga Samba Mutton Biryani','Biryani','Tamil Special',320),
('Chettinad Chicken','Tamil Curries','Tamil Special',230),('Mutton Chukka','Tamil Curries','Tamil Special',290),('Nattu Kozhi Varuval','Tamil Curries','Tamil Special',320),('Fish Fry (Vanjaram)','Tamil Curries','Tamil Special',350),('Prawn Thokku','Tamil Curries','Tamil Special',300),('Kola Urundai','Tamil Curries','Tamil Special',180),('Parotta (2 pcs)','Tamil Curries','Tamil Special',50),('Kothu Parotta Chicken','Tamil Curries','Tamil Special',180),
('Kunafa','Desserts & Drinks','Arabian',180),('Arabian Pudding','Desserts & Drinks','Arabian',120),('Mint Lime Soda','Desserts & Drinks','Arabian',70),('Mojito','Desserts & Drinks','Arabian',110),('Falooda','Desserts & Drinks','Arabian',140),('Sulaimani Tea','Desserts & Drinks','Arabian',30)
) as t(n,c,cu,p);