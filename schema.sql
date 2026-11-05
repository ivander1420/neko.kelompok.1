-- ============================================================================
-- NEKO · Belajar TJKT Sambil Bermain — skrip database untuk Supabase
-- Target: Supabase (PostgreSQL 15+). Jalankan di: Supabase Dashboard →
--         SQL Editor → New query → paste seluruh file → Run.
--
-- File ini BISA dijalankan berulang kali (idempotent / IF NOT EXISTS).
--
-- Dua pemakaian:
--   1) MODE SERVER  : Node NEKO menyimpan seluruh state ke tabel `neko_snapshot`
--                     (1 baris, key='main'). Cukup 1 baris, tanpa perlu tabel lain.
--   2) MODE LANGSUNG: bila nanti aplikasi menghubungi Supabase langsung (PostgREST +
--                     Realtime), pakai tabel normal di bawah ini.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) AKUN & SESI
-- ----------------------------------------------------------------------------

create table if not exists neko_users (
  username        text primary key,                 -- key sama seperti di server (lowercase)
  display_name    text not null default '',
  pin_hash        text not null default '',
  pin_salt        text not null default '',
  scrypt_n        int  not null default 16384,
  role            text not null default 'Member',   -- Member | Guru | Wali Kelas | Admin | President | Developer
  preset          boolean not null default false,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz
);

create table if not exists neko_sessions (
  token_hash      text primary key,
  username        text not null references neko_users(username) on delete cascade,
  device          text not null default '',
  created_at      timestamptz not null default now(),
  expires_at      timestamptz
);
create index if not exists neko_sessions_username_idx on neko_sessions(username);

-- Profil, preferensi, dan seluruh angka progres satu akun.
create table if not exists neko_profiles (
  username        text primary key references neko_users(username) on delete cascade,
  profile         jsonb not null default '{}'::jsonb,  -- xp, gelar, badge, riwayat game
  prefs           jsonb not null default '{}'::jsonb,  -- tema, suara, sidebar, check-in
  seen            jsonb not null default '{}'::jsonb,  -- pengumuman yang sudah dibaca
  updated_at      timestamptz not null default now()
);

-- Catatan per kejadian XP, supaya leaderboard dapat direkap/diaudit.
create table if not exists neko_xp_log (
  id              bigserial primary key,
  username        text not null references neko_users(username) on delete cascade,
  reason          text not null,          -- read | game | live | checkin | bonus
  amount          int  not null default 0,
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists neko_xp_log_username_idx on neko_xp_log(username, created_at desc);

-- Progres bacaan per buku.
create table if not exists neko_book_progress (
  username        text not null references neko_users(username) on delete cascade,
  chapter_id      text not null,
  page            int  not null default 0,
  completed       boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (username, chapter_id)
);

-- Rekor game (untuk tab Koleksi dan leaderboard sekolah).
create table if not exists neko_game_scores (
  id              bigserial primary key,
  username        text not null references neko_users(username) on delete cascade,
  game_id         text not null,          -- quiz | spy | cable | memory | subnet | osi | detective | reaction
  score           int  not null default 0,
  mode            text not null default 'solo',   -- solo | live
  created_at      timestamptz not null default now()
);
create index if not exists neko_game_scores_top_idx on neko_game_scores(game_id, score desc);

-- Check-in harian.
create table if not exists neko_checkins (
  username        text not null references neko_users(username) on delete cascade,
  day             date not null,
  streak          int  not null default 1,
  xp_awarded      int  not null default 0,
  primary key (username, day)
);

-- ----------------------------------------------------------------------------
-- 2) KOMUNITAS (pengumuman admin + papan informasi)
-- ----------------------------------------------------------------------------

create table if not exists neko_announcements (
  id              text primary key,
  title           text not null,
  body            text not null default '',
  level           text not null default 'info',   -- info | warning | success
  author          text not null default 'admin',
  school          text not null default 'umum',   -- 'umum' atau kode sekolah
  pinned          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists neko_announcements_recent_idx on neko_announcements(created_at desc);

create table if not exists neko_info_board (
  id              int primary key default 1 check (id = 1),
  title           text not null default 'Papan informasi NEKO',
  body            text not null default 'Belum ada informasi baru dari admin.',
  updated_by      text not null default '',
  updated_at      timestamptz not null default now()
);
insert into neko_info_board (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3) TEMAN & CHAT
-- ----------------------------------------------------------------------------

create table if not exists neko_friendships (
  username        text not null references neko_users(username) on delete cascade,
  other_username  text not null references neko_users(username) on delete cascade,
  status          text not null default 'pending',   -- pending | accepted
  direction       text not null default 'outgoing',  -- incoming | outgoing
  requested_by    text not null default '',
  updated_at      timestamptz not null default now(),
  primary key (username, other_username)
);

create table if not exists neko_conversations (
  id              text primary key,                  -- 'direct:<a>|<b>' atau id grup
  kind            text not null default 'direct',
  title           text not null default '',
  members         jsonb not null default '[]'::jsonb,
  created_by      text not null default '',
  created_at      timestamptz not null default now(),
  last_seq        bigint not null default 0
);

create table if not exists neko_messages (
  seq             bigserial primary key,
  conversation_id text not null references neko_conversations(id) on delete cascade,
  sender          text not null,
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists neko_messages_conversation_idx on neko_messages(conversation_id, seq);

create table if not exists neko_reads (
  conversation_id text not null references neko_conversations(id) on delete cascade,
  username        text not null references neko_users(username) on delete cascade,
  last_read_seq   bigint not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (conversation_id, username)
);

-- ----------------------------------------------------------------------------
-- 4) KELAS LANGSUNG (Kahoot NEKO) — state ruangan + jejak jawaban
-- ----------------------------------------------------------------------------

create table if not exists neko_live_rooms (
  pin             text primary key,
  host            text not null default '',
  level           text not null default 'campuran',
  topic           text not null default 'campuran',
  question_count  int  not null default 8,
  seconds         int  not null default 20,
  phase           text not null default 'lobby',    -- lobby | question | reveal | finished
  question_index  int  not null default 0,
  rev             bigint not null default 0,
  state           jsonb not null default '{}'::jsonb,  -- salinan room utuh (cepat dimuat ulang)
  school          text not null default '',
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  ended_at        timestamptz
);
create index if not exists neko_live_rooms_active_idx on neko_live_rooms(ended_at, created_at desc);

create table if not exists neko_live_players (
  pin             text not null references neko_live_rooms(pin) on delete cascade,
  player_key      text not null,
  name            text not null,
  character_id    text not null default '',
  username        text not null default '',
  score           int  not null default 0,
  streak          int  not null default 0,
  joined_at       timestamptz not null default now(),
  last_answer_at  timestamptz,
  primary key (pin, player_key)
);

-- Unik: satu pemain hanya menjawab satu kali per soal (anti curang).
create table if not exists neko_live_answers (
  pin             text not null,
  player_key      text not null,
  question_index  int  not null,
  choice          int  not null,
  correct         boolean not null default false,
  points          int  not null default 0,
  time_ms         int  not null default 0,
  created_at      timestamptz not null default now(),
  primary key (pin, player_key, question_index)
);

-- ----------------------------------------------------------------------------
-- 5) KANAL EVENT (dipakai /api/events dan fallback long-poll)
-- ----------------------------------------------------------------------------

create table if not exists neko_events (
  seq             bigserial primary key,
  kind            text not null,          -- message | friend | announcement | live | profile
  target          text not null default '',   -- username, 'all', atau 'live:<pin>'
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists neko_events_target_idx on neko_events(target, seq);

-- ----------------------------------------------------------------------------
-- 6) MIRROR UNTUK SERVER NODE (dipakai SEKARANG, tanpa merombak server.js)
--    Struktur `value` = persis isi server/db.json:
--    { users, sessions, community, friends, chats, seen }
-- ----------------------------------------------------------------------------

create table if not exists neko_snapshot (
  key             text primary key default 'main',
  value           jsonb not null default '{}'::jsonb,
  revision        bigint not null default 0,
  updated_at      timestamptz not null default now()
);
insert into neko_snapshot (key, value) values ('main', '{}'::jsonb) on conflict (key) do nothing;

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Aturan main:
--   * SERVICE ROLE (key rahasia di server) = boleh segalanya, RLS dilewati.
--   * ANON KEY (di APK/browser) = hanya boleh baca hal yang memang publik,
--     dan hanya boleh menulis baris miliknya sendiri (username = token JWT).
-- Jangan pernah menaruh service_role key di APK atau di JavaScript browser.

alter table neko_users          enable row level security;
alter table neko_sessions       enable row level security;
alter table neko_profiles       enable row level security;
alter table neko_xp_log         enable row level security;
alter table neko_book_progress  enable row level security;
alter table neko_game_scores    enable row level security;
alter table neko_checkins       enable row level security;
alter table neko_announcements  enable row level security;
alter table neko_info_board     enable row level security;
alter table neko_friendships    enable row level security;
alter table neko_conversations  enable row level security;
alter table neko_messages       enable row level security;
alter table neko_reads          enable row level security;
alter table neko_live_rooms     enable row level security;
alter table neko_live_players   enable row level security;
alter table neko_live_answers   enable row level security;
alter table neko_events         enable row level security;
alter table neko_snapshot       enable row level security;

-- Pengumuman & papan informasi: siapa pun boleh membaca (termasuk Mode Langsung).
drop policy if exists "publik boleh baca pengumuman" on neko_announcements;
create policy "publik boleh baca pengumuman" on neko_announcements for select using (true);

drop policy if exists "publik boleh baca papan informasi" on neko_info_board;
create policy "publik boleh baca papan informasi" on neko_info_board for select using (true);

-- Rekor & leaderboard boleh dibaca publik; tulis hanya lewat server.
drop policy if exists "publik boleh baca skor" on neko_game_scores;
create policy "publik boleh baca skor" on neko_game_scores for select using (true);

-- Ruangan Kelas Langsung boleh dibaca/dilihat publik (siswa join pakai PIN),
-- tetapi perubahan state tetap ditulis oleh server.
drop policy if exists "publik boleh baca ruangan live" on neko_live_rooms;
create policy "publik boleh baca ruangan live" on neko_live_rooms for select using (true);
drop policy if exists "publik boleh baca pemain live" on neko_live_players;
create policy "publik boleh baca pemain live" on neko_live_players for select using (true);
drop policy if exists "pemilik boleh jawab soal" on neko_live_answers;
create policy "pemilik boleh jawab soal" on neko_live_answers for insert
  with check (true);

-- Akun sendiri: baca/baru-buat profil milik sendiri (username = klaim JWT `sub`
-- atau `user_metadata.username` bila Anda memakai Supabase Auth).
drop policy if exists "pemilik boleh baca profil" on neko_profiles;
create policy "pemilik boleh baca profil" on neko_profiles for select
  using (username = coalesce(auth.jwt() ->> 'username', auth.jwt() ->> 'sub', ''));
drop policy if exists "pemilik boleh ubah profil" on neko_profiles;
create policy "pemilik boleh ubah profil" on neko_profiles for update
  using (username = coalesce(auth.jwt() ->> 'username', auth.jwt() ->> 'sub', ''));

-- Chat: hanya anggota percakapan.
drop policy if exists "anggota boleh baca percakapan" on neko_conversations;
create policy "anggota boleh baca percakapan" on neko_conversations for select
  using (members ?> jsonb_build_array(coalesce(auth.jwt() ->> 'username', '')));
drop policy if exists "anggota boleh kirim pesan" on neko_messages;
create policy "anggota boleh kirim pesan" on neko_messages for insert
  with check (exists (
    select 1 from neko_conversations c
    where c.id = conversation_id
      and c.members ?> jsonb_build_array(coalesce(auth.jwt() ->> 'username', ''))
  ));
drop policy if exists "anggota boleh baca pesan" on neko_messages;
create policy "anggota boleh baca pesan" on neko_messages for select
  using (exists (
    select 1 from neko_conversations c
    where c.id = conversation_id
      and c.members ?> jsonb_build_array(coalesce(auth.jwt() ->> 'username', ''))
  ));

-- Mirror snapshot TIDAK boleh diakses anon sama sekali (hanya service role).
-- (Tidak ada policy select/insert untuk anon = otomatis tertutup.)

-- ============================================================================
-- Realtime (untuk Mode Langsung: langganan perubahan baris)
-- ============================================================================
-- Supabase memakai sebuah publication bernama `supabase_realtime`. Menambah
-- tabel ke publication dilakukan sekali; perintah di bawah aman bila diulang.

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'neko_messages') then
    alter publication supabase_realtime add table neko_messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'neko_live_rooms') then
    alter publication supabase_realtime add table neko_live_rooms;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'neko_live_players') then
    alter publication supabase_realtime add table neko_live_players;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'neko_announcements') then
    alter publication supabase_realtime add table neko_announcements;
  end if;
end $$;

-- ============================================================================
-- Fungsional pendukung
-- ============================================================================

-- Rekap XP seorang pengguna dari log (berguna untuk audit atau pindah perangkat).
create or replace function neko_xp_total(p_username text)
returns bigint
language sql stable
as $$
  select coalesce(sum(amount), 0)::bigint from neko_xp_log where username = p_username;
$$;

-- Membersihkan ruangan live lama (mis. dijadwalkan tiap malam lewat pg_cron):
--   delete from neko_live_rooms where ended_at < now() - interval '7 days';

-- ============================================================================
-- Seeding awal (aman diulang, tidak menimpa data)
-- ============================================================================
insert into neko_announcements (id, title, body, level, author, created_at)
values ('seed-welcome', 'NEKO sudah online',
        'Akun, progres, dan Kelas Langsung kini tersimpan di Supabase. Selamat belajar TJKT!',
        'success', 'developer', now())
on conflict (id) do nothing;

-- ============================================================================
-- Cek cepat setelah menjalankan skrip (hapus komentar untuk menjalankan):
-- select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'neko_%' order by tablename;
-- ============================================================================
