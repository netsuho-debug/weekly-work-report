-- Design Ref: §3 저장할 데이터 (Supabase 표)
-- 이 파일은 "여러 번 실행해도 안전하게" 쓴다 (이미 있으면 건너뛰거나 덮어씀).
-- 표: offices, reports, report_items (작업 7) · access_codes, login_attempts (작업 13·14)
-- 함수: submit_report() (보고 덮어쓰기) · change_codes() (코드 여러 개를 한 번에 변경)
--
-- 보안: 모든 표는 행 수준 보안(RLS)을 켜고 정책을 하나도 만들지 않는다.
--       → 브라우저(anon 열쇠)에서는 아무 데이터도 읽거나 쓸 수 없고,
--         서버 코드가 서비스 열쇠(SUPABASE_SERVICE_ROLE_KEY)로만 접근한다.

-- ── 청사 13곳 (고정) ────────────────────────────────────────────
create table if not exists public.offices (
  id   smallint primary key check (id between 1 and 13),
  name text not null
);

insert into public.offices (id, name)
select n, n || '청사' from generate_series(1, 13) as n
on conflict (id) do nothing;

-- ── 주간 보고 (한 청사·한 주에 1건) ────────────────────────────
create table if not exists public.reports (
  id             bigint generated always as identity primary key,
  office_id      smallint not null references public.offices (id),
  week_start     date     not null check (extract(isodow from week_start) = 1), -- 월요일만
  submitted_at   timestamptz not null,   -- 마지막 제출 시각
  is_late        boolean     not null,   -- 마지막 제출이 마감(화 14:00 KST) 이후인지
  this_week_none boolean     not null default false, -- "이번 주" 작업 없음
  next_week_none boolean     not null default false, -- "다음 주" 작업 없음
  unique (office_id, week_start)         -- 한 청사·한 주 1건 보장
);

-- ── 작업 1건 = 1줄 ─────────────────────────────────────────────
create table if not exists public.report_items (
  id        bigint generated always as identity primary key,
  report_id bigint   not null references public.reports (id) on delete cascade,
  section   text     not null check (section in ('this', 'next')),
  seq       smallint not null check (seq between 1 and 20),
  title     text     not null check (char_length(title) between 1 and 50),
  content   text     not null check (char_length(content) between 1 and 500),
  amount    bigint   check (amount >= 0),  -- 비어 있으면 "미정" (다음 주만 허용: 아래 검사)
  unique (report_id, section, seq),
  -- 이번 주 작업은 금액이 반드시 있어야 한다
  check (section = 'next' or amount is not null)
);

alter table public.offices      enable row level security;
alter table public.reports      enable row level security;
alter table public.report_items enable row level security;

-- ── 보고 제출(덮어쓰기)을 한 번에 처리하는 함수 ──────────────────
-- 같은 청사·같은 주 보고가 있으면 갱신하고 작업 행을 지운 뒤 다시 넣는다.
-- 함수 안은 한 트랜잭션이라, 중간에 실패하면 전부 되돌려진다. (DESIGN §3)
create or replace function public.submit_report(
  p_office_id    smallint,
  p_week_start   date,
  p_submitted_at timestamptz,
  p_is_late      boolean,
  p_this_none    boolean,
  p_next_none    boolean,
  p_items        jsonb      -- [{section, seq, title, content, amount|null}, ...]
) returns bigint
language plpgsql
as $$
declare
  v_report_id bigint;
begin
  insert into public.reports as r
    (office_id, week_start, submitted_at, is_late, this_week_none, next_week_none)
  values
    (p_office_id, p_week_start, p_submitted_at, p_is_late, p_this_none, p_next_none)
  on conflict (office_id, week_start) do update
    set submitted_at   = excluded.submitted_at,
        is_late        = excluded.is_late,
        this_week_none = excluded.this_week_none,
        next_week_none = excluded.next_week_none
  returning r.id into v_report_id;

  delete from public.report_items where report_id = v_report_id;

  insert into public.report_items (report_id, section, seq, title, content, amount)
  select v_report_id,
         e ->> 'section',
         (e ->> 'seq')::smallint,
         e ->> 'title',
         e ->> 'content',
         (e ->> 'amount')::bigint        -- JSON null → SQL null ("미정")
  from jsonb_array_elements(p_items) as e;

  return v_report_id;
end;
$$;

-- 함수는 서버(서비스 열쇠)만 부를 수 있게 한다. 브라우저 열쇠(anon·로그인 사용자)로는 호출 불가.
revoke all on function public.submit_report(smallint, date, timestamptz, boolean, boolean, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_report(smallint, date, timestamptz, boolean, boolean, boolean, jsonb)
  to service_role;

-- ═══════════════════════════════════════════════════════════════
-- 작업 13: 접속 코드 (청사 13개 + 부서용 1개)
-- ═══════════════════════════════════════════════════════════════

-- ── 접속 코드 14줄 ─────────────────────────────────────────────
-- 코드 원문은 저장하지 않고 HMAC-SHA256(코드, CODE_PEPPER) 해시값만 둔다. (DESIGN §3)
-- version 은 코드를 바꿀 때마다 +1. 쿠키에 담긴 version 이 현재 값과 다르면 옛 쿠키는 무효가 된다.
create table if not exists public.access_codes (
  id        smallint generated always as identity primary key,
  role      text     not null check (role in ('office', 'dept')),
  office_id smallint references public.offices (id),
  code_hash text     not null unique,   -- 같은 코드를 두 곳에 쓸 수 없다 (중복 코드 방지)
  version   integer  not null default 1,
  -- 청사 코드는 청사 번호가 반드시 있고, 부서용 코드에는 청사 번호가 없다
  check ((role = 'office' and office_id is not null) or (role = 'dept' and office_id is null))
);
-- 청사마다 코드는 1개, 부서용 코드도 1개
create unique index if not exists access_codes_one_per_office
  on public.access_codes (office_id) where role = 'office';
create unique index if not exists access_codes_one_dept
  on public.access_codes (role) where role = 'dept';

-- ── 틀린 입력 기록 (5회 틀리면 15분 잠금용) ─────────────────────
create table if not exists public.login_attempts (
  id       bigint generated always as identity primary key,
  ip       text        not null,
  tried_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_time on public.login_attempts (ip, tried_at);

alter table public.access_codes   enable row level security;
alter table public.login_attempts enable row level security;

-- ═══════════════════════════════════════════════════════════════
-- 작업 14: 접속 코드 변경 (여러 칸을 한 번에, 실패하면 전부 되돌림)
-- ═══════════════════════════════════════════════════════════════
-- p_changes: [{ "role": "dept"|"office", "office_id": 번호|null, "code_hash": "..." }, ...]
-- 바뀐 칸은 version 이 +1 되어, 옛 코드와 이미 발급된 쿠키가 모두 무효가 된다.
-- 함수 안은 한 트랜잭션이라, 중간에 중복 코드 등으로 실패하면 어느 칸도 바뀌지 않는다.
create or replace function public.change_codes(p_changes jsonb)
returns integer
language plpgsql
as $$
declare
  e jsonb;
  n integer := 0;
begin
  for e in select * from jsonb_array_elements(p_changes) loop
    update public.access_codes
       set code_hash = e ->> 'code_hash',
           version   = version + 1
     where role = e ->> 'role'
       and office_id is not distinct from nullif(e ->> 'office_id', '')::smallint;
    if not found then
      raise exception 'access code slot not found: %', e ->> 'role';
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.change_codes(jsonb) from public, anon, authenticated;
grant execute on function public.change_codes(jsonb) to service_role;
