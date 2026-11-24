-- ============================================================================
-- Migration 030: Seed Animated Exercise GIF Paths on All 24 Built-in Exercises
-- Description:
--   Maps every built-in exercise (business_id IS NULL) in public.gym_exercises
--   to its bundled animated GIF under /exercises/*.gif so every workout row,
--   Exercise Library card, and Active Workout Session renders real GIFs.
-- SQL Safety:
--   - Uses pg_catalog.lower(...) & CASE expression cleanly.
-- ============================================================================

begin;

update public.gym_exercises
   set animation_gif_url = case pg_catalog.lower(name)
     when 'barbell bench press' then '/exercises/barbell-bench-press.gif'
     when 'incline dumbbell press' then '/exercises/incline-dumbbell-press.gif'
     when 'cable chest fly' then '/exercises/cable-chest-fly.gif'
     when 'pec deck machine fly' then '/exercises/pec-deck-machine-fly.gif'
     when 'wide-grip lat pulldown' then '/exercises/wide-grip-lat-pulldown.gif'
     when 'bent-over barbell row' then '/exercises/bent-over-barbell-row.gif'
     when 'seated cable row' then '/exercises/seated-cable-row.gif'
     when 'barbell deadlift' then '/exercises/barbell-deadlift.gif'
     when 'barbell back squat' then '/exercises/barbell-back-squat.gif'
     when '45° leg press machine' then '/exercises/leg-press-machine.gif'
     when 'romanian deadlift (rdl)' then '/exercises/romanian-deadlift.gif'
     when 'seated leg curl' then '/exercises/seated-leg-curl.gif'
     when 'standing calf raise' then '/exercises/standing-calf-raise.gif'
     when 'overhead barbell press (ohp)' then '/exercises/overhead-barbell-press.gif'
     when 'seated dumbbell shoulder press' then '/exercises/seated-dumbbell-shoulder-press.gif'
     when 'dumbbell lateral raises' then '/exercises/dumbbell-lateral-raises.gif'
     when 'cable face pulls' then '/exercises/cable-face-pulls.gif'
     when 'ez-bar bicep curl' then '/exercises/ez-bar-bicep-curl.gif'
     when 'dumbbell hammer curl' then '/exercises/dumbbell-hammer-curl.gif'
     when 'tricep rope pushdown' then '/exercises/tricep-rope-pushdown.gif'
     when 'hanging leg raises' then '/exercises/hanging-leg-raises.gif'
     when 'kneeling cable crunch' then '/exercises/kneeling-cable-crunch.gif'
     when 'treadmill hiit intervals' then '/exercises/treadmill-hiit-intervals.gif'
     when 'weighted / classic push-ups' then '/exercises/push-ups.gif'
     else animation_gif_url
   end
 where business_id is null;

commit;
