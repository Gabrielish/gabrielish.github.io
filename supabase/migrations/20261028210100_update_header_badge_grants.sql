-- Existing update writes use a column allowlist. RLS still requires the administrator/author.
grant insert (badge_color,badge_icon,badge_svg), update (badge_color,badge_icon,badge_svg)
 on public.bg3ro_project_updates to authenticated;
