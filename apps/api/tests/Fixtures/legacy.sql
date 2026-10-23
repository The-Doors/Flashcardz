CREATE TABLE public.alembic_version (version_num varchar(32) PRIMARY KEY);
INSERT INTO public.alembic_version VALUES ('legacy');
CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username varchar(50) NOT NULL CONSTRAINT users_username_key UNIQUE
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.cards (
    id integer PRIMARY KEY,
    creator_id uuid REFERENCES public.users(id)
);
CREATE TABLE public.decks (
    id integer PRIMARY KEY,
    owner_id uuid REFERENCES public.users(id)
);
CREATE TABLE public.instances (
    deck_id integer REFERENCES public.decks(id),
    card_id integer REFERENCES public.cards(id)
);
INSERT INTO auth.users VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.users VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Casey');
INSERT INTO public.cards VALUES (1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.decks VALUES (1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.instances VALUES (1, 1);
