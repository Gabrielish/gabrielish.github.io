-- Header badges belong to existing admin-only manual updates. Preserve all RLS policies.
alter table public.bg3ro_project_updates
 add column badge_color text not null default '#22c55e' check (badge_color ~ '^#[0-9a-fA-F]{6}$'),
 add column badge_icon text not null default '' check (char_length(badge_icon)<=32),
 add column badge_svg text not null default '' check (char_length(badge_svg)<=16000);
-- SVG markup is never inserted verbatim: the shared client renderer rebuilds only
-- allowed vector geometry, stripping scripts, events, URLs and foreign objects.
