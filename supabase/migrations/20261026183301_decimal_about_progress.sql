alter table public.bg3ro_about_sections
  alter column translation_percent type numeric(5,2) using translation_percent::numeric(5,2),
  alter column review_percent type numeric(5,2) using review_percent::numeric(5,2),
  alter column testing_percent type numeric(5,2) using testing_percent::numeric(5,2);
notify pgrst, 'reload schema';
