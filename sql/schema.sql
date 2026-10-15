-- ==========================================================
-- ClassCash v2 - Skema Database FINAL (Supabase / PostgreSQL)
-- Jalankan sekali di: Supabase > SQL Editor > New query > Run
-- Gunakan proyek Supabase yang masih kosong.
-- Fitur: peran (siswa/guru/bendahara) dijaga RLS, kas dicicil per minggu.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. TABEL
-- ----------------------------------------------------------

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  weekly_amount integer not null default 6000 check (weekly_amount > 0),
  created_at    timestamptz not null default now()
);

-- Peran disimpan di sini (server), bukan di browser.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'siswa'
             check (role in ('siswa', 'guru', 'bendahara')),
  class_id   uuid references public.classes(id),
  created_at timestamptz not null default now()
);

create table public.students (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id),
  type        text not null check (type in ('income', 'expense')),
  amount      integer not null check (amount > 0),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  tx_date     date not null default current_date,
  student_id  uuid references public.students(id) on delete set null,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

-- Satu baris = satu pembayaran iuran (boleh banyak per siswa per minggu).
create table public.weekly_payments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  year           smallint not null check (year between 2000 and 2100),
  month          smallint not null check (month between 1 and 12),
  week           smallint not null check (week between 1 and 5),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index transactions_class_date_idx on public.transactions (class_id, tx_date desc);
create index weekly_payments_lookup_idx on public.weekly_payments (student_id, year, month, week);

-- ----------------------------------------------------------
-- 2. FUNGSI BANTU (dipakai aturan RLS)
-- ----------------------------------------------------------

create or replace function public.current_class_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select class_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_bendahara(p_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'bendahara' and class_id = p_class
  )
$$;

-- ----------------------------------------------------------
-- 3. TRIGGER: akun baru otomatis jadi "siswa" di kelas pertama
-- ----------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, class_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'siswa',
    (select id from public.classes order by created_at limit 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- 4. FUNGSI KAS: tambah / batalkan pembayaran (atomik, hanya bendahara)
-- ----------------------------------------------------------

create or replace function public.add_weekly_payment(
  p_student uuid,
  p_year    integer,
  p_month   integer,
  p_week    integer,
  p_amount  integer
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_class  uuid;
  v_name   text;
  v_weekly integer;
  v_paid   integer;
  v_tx     uuid;
begin
  if p_month not between 1 and 12 or p_week not between 1 and 5 then
    raise exception 'Bulan atau minggu tidak valid';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0';
  end if;

  select s.class_id, s.name, c.weekly_amount
    into v_class, v_name, v_weekly
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = p_student
  for update of s;

  if v_class is null then
    raise exception 'Siswa tidak ditemukan';
  end if;
  if not public.is_bendahara(v_class) then
    raise exception 'Hanya bendahara yang boleh mengubah kas';
  end if;

  select coalesce(sum(t.amount), 0) into v_paid
  from public.weekly_payments wp
  join public.transactions t on t.id = wp.transaction_id
  where wp.student_id = p_student and wp.year = p_year
    and wp.month = p_month and wp.week = p_week;

  if v_paid + p_amount > v_weekly then
    raise exception 'Melebihi iuran minggu ini (sisa Rp %)', v_weekly - v_paid;
  end if;

  insert into public.transactions
    (class_id, type, amount, description, student_id)
  values (
    v_class, 'income', p_amount,
    format('Iuran kas %s - minggu %s (%s/%s)', v_name, p_week, p_month, p_year),
    p_student
  )
  returning id into v_tx;

  insert into public.weekly_payments (student_id, year, month, week, transaction_id)
  values (p_student, p_year, p_month, p_week, v_tx);
end;
$$;

create or replace function public.remove_weekly_payment(p_payment uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_class uuid;
  v_tx    uuid;
begin
  select s.class_id, wp.transaction_id
    into v_class, v_tx
  from public.weekly_payments wp
  join public.students s on s.id = wp.student_id
  where wp.id = p_payment;

  if v_class is null then
    raise exception 'Pembayaran tidak ditemukan';
  end if;
  if not public.is_bendahara(v_class) then
    raise exception 'Hanya bendahara yang boleh mengubah kas';
  end if;

  delete from public.transactions where id = v_tx;
end;
$$;

-- ----------------------------------------------------------
-- 5. VIEW (mengikuti RLS pengguna yang memanggil)
-- ----------------------------------------------------------

create or replace view public.class_balance
with (security_invoker = true) as
select
  class_id,
  coalesce(sum(amount) filter (where type = 'income'), 0)  as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  coalesce(sum(amount) filter (where type = 'income'), 0)
    - coalesce(sum(amount) filter (where type = 'expense'), 0) as balance
from public.transactions
group by class_id;

create or replace view public.weekly_totals
with (security_invoker = true) as
select
  wp.student_id, wp.year, wp.month, wp.week,
  sum(t.amount)::integer as paid,
  count(*)::integer      as payments
from public.weekly_payments wp
join public.transactions t on t.id = wp.transaction_id
group by wp.student_id, wp.year, wp.month, wp.week;

-- ----------------------------------------------------------
-- 6. KEAMANAN: RLS + HAK AKSES
-- anon (belum login) tidak boleh apa-apa. Siswa/guru hanya baca.
-- Bendahara menulis hanya di kelasnya.
-- ----------------------------------------------------------

alter table public.classes         enable row level security;
alter table public.profiles        enable row level security;
alter table public.students        enable row level security;
alter table public.transactions    enable row level security;
alter table public.weekly_payments enable row level security;

revoke all on public.classes, public.profiles, public.students,
              public.transactions, public.weekly_payments,
              public.class_balance, public.weekly_totals
  from anon, authenticated;

grant select on public.classes, public.profiles, public.students,
                public.transactions, public.weekly_payments,
                public.class_balance, public.weekly_totals
  to authenticated;

grant update (full_name)     on public.profiles     to authenticated; -- peran tidak bisa diubah sendiri
grant insert, update         on public.students     to authenticated;
grant insert, update, delete on public.transactions to authenticated;
-- weekly_payments tanpa tulis langsung: hanya lewat fungsi di bagian 4.

create policy "baca kelas sendiri" on public.classes
  for select to authenticated
  using (id = public.current_class_id());

create policy "baca profil sendiri" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "ubah nama sendiri" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "baca siswa sekelas" on public.students
  for select to authenticated
  using (class_id = public.current_class_id());

create policy "bendahara tambah siswa" on public.students
  for insert to authenticated
  with check (public.is_bendahara(class_id));

create policy "bendahara ubah siswa" on public.students
  for update to authenticated
  using (public.is_bendahara(class_id))
  with check (public.is_bendahara(class_id));

create policy "baca transaksi sekelas" on public.transactions
  for select to authenticated
  using (class_id = public.current_class_id());

create policy "bendahara tambah transaksi" on public.transactions
  for insert to authenticated
  with check (
    public.is_bendahara(class_id)
    and created_by = auth.uid()
    and student_id is null          -- iuran siswa hanya lewat fungsi
  );

create policy "bendahara ubah transaksi manual" on public.transactions
  for update to authenticated
  using (public.is_bendahara(class_id) and student_id is null)
  with check (public.is_bendahara(class_id) and student_id is null);

create policy "bendahara hapus transaksi manual" on public.transactions
  for delete to authenticated
  using (public.is_bendahara(class_id) and student_id is null);

create policy "baca status kas sekelas" on public.weekly_payments
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = weekly_payments.student_id
        and s.class_id = public.current_class_id()
    )
  );

revoke execute on function public.current_class_id()  from public, anon;
revoke execute on function public.is_bendahara(uuid)  from public, anon;
revoke execute on function public.handle_new_user()   from public, anon, authenticated;
revoke execute on function public.add_weekly_payment(uuid, integer, integer, integer, integer)
  from public, anon;
revoke execute on function public.remove_weekly_payment(uuid)
  from public, anon;

grant execute on function public.current_class_id() to authenticated;
grant execute on function public.is_bendahara(uuid) to authenticated;
grant execute on function public.add_weekly_payment(uuid, integer, integer, integer, integer)
  to authenticated;
grant execute on function public.remove_weekly_payment(uuid)
  to authenticated;

-- ----------------------------------------------------------
-- 7. DATA AWAL
-- ----------------------------------------------------------

-- Kelas dan iuran mingguan (Rp 1.000 x 6 hari). Ubah sesuai kebutuhan.
insert into public.classes (name, weekly_amount)
values ('10 AKL 1', 6000);

-- ----------------------------------------------------------
-- 8. AKUN DEMO
-- Buat akun lewat Supabase > Authentication > Users > Add user
-- (centang Auto Confirm User), lalu tetapkan peran dengan query ini:
-- ----------------------------------------------------------

-- update public.profiles set role = 'bendahara'
--   where id = (select id from auth.users where email = 'bendahara@contoh.com');

-- update public.profiles set role = 'guru'
--   where id = (select id from auth.users where email = 'guru@contoh.com');

-- Akun yang tidak diubah otomatis berperan 'siswa'.

-- ----------------------------------------------------------
-- 9. CEK KEAMANAN (jalankan setelah selesai)
-- ----------------------------------------------------------

-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public';
