-- Local development data, loaded by `supabase start` and `supabase db reset`.
-- Two organizers and a handful of upcoming events around Valencia, dated relative to
-- the moment the seed runs so they are always in the future.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated',
   'authenticated', 'lucia@example.com', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated',
   'authenticated', 'marc@example.com', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

insert into public.profiles (id, username, bio, confirmed_minimum_age, id_verified_at) values
  ('11111111-1111-1111-1111-111111111111', 'lucia', 'Paella, jazz and long walks by the Turia.', true, now()),
  ('22222222-2222-2222-2222-222222222222', 'marc', 'Runner and board game collector.', true, null);

insert into public.events (organizer_id, title, description, category, starts_at, ends_at,
                           max_participants, location, address, area_label)
values
  ('11111111-1111-1111-1111-111111111111', 'Paella night on the rooftop',
   'We cook a Valencian paella together. Bring something to drink.', 'food',
   date_trunc('day', now()) + interval '2 days 20 hours', date_trunc('day', now()) + interval '2 days 23 hours',
   12, 'SRID=4326;POINT(-0.37631 39.46247)', 'Carrer de Sueca 12, Valencia', 'Russafa, Valencia'),
  ('11111111-1111-1111-1111-111111111111', 'Jazz jam session',
   'Open jam. Instruments welcome, listeners too.', 'music',
   date_trunc('day', now()) + interval '4 days 21 hours', null,
   40, 'SRID=4326;POINT(-0.37960 39.47790)', 'Carrer de Cavallers 25, Valencia', 'El Carme, Valencia'),
  ('22222222-2222-2222-2222-222222222222', 'Sunday run in the Turia',
   '10 km at an easy pace, then coffee.', 'sport',
   date_trunc('day', now()) + interval '6 days 9 hours', date_trunc('day', now()) + interval '6 days 11 hours',
   null, 'SRID=4326;POINT(-0.36580 39.47390)', 'Pont de les Flors, Valencia', 'Jardí del Túria, Valencia'),
  ('22222222-2222-2222-2222-222222222222', 'Board games evening',
   'Catan, Carcassonne and whatever you bring.', 'social',
   date_trunc('day', now()) + interval '3 days 19 hours', null,
   8, 'SRID=4326;POINT(-0.35300 39.46700)', 'Avinguda del Port 40, Valencia', 'Camins al Grau, Valencia'),
  ('11111111-1111-1111-1111-111111111111', 'Sunset at La Malvarrosa',
   'Picnic and volleyball on the beach.', 'outdoors',
   date_trunc('day', now()) + interval '5 days 18 hours', null,
   null, 'SRID=4326;POINT(-0.32430 39.47820)', 'Platja de la Malva-rosa, Valencia', 'La Malva-rosa, Valencia'),
  ('22222222-2222-2222-2222-222222222222', 'Albufera boat trip',
   'Boat ride on the lake and all i pebre lunch in El Palmar.', 'outdoors',
   date_trunc('day', now()) + interval '9 days 11 hours', null,
   15, 'SRID=4326;POINT(-0.33000 39.33500)', 'El Palmar, Valencia', 'El Palmar, Valencia');
