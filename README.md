# Flashcardz

(WIP) Don't worry about it

## Installation

Prerequisites:

- Docker (Windows: use WSL2)
- [node](https://nodejs.org/en/download)
- [supabase cli](https://supabase.com/docs/guides/local-development/cli/getting-started)

### Api

First setup, from the repository root (keep your existing `.env` and `APP_KEY` if already configured):

```
supabase start
cd apps/api
cp .env.example .env
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/app" -w /app composer:2 install --no-scripts --ignore-platform-reqs
./vendor/bin/sail up -d --build
./vendor/bin/sail composer install
./vendor/bin/sail artisan key:generate
./vendor/bin/sail artisan migrate
./vendor/bin/sail artisan optimize:clear
```

The API uses port 8000. 

For later starts, run `supabase start` from the repository root and `./vendor/bin/sail up -d` from `apps/api`. 

To see logs, use

```
./vendor/bin/sail logs -f
./vendor/bin/sail artisan pail # i think only exceptions??
```

### Web

You first have to install web dependencies. Then, while the back end is running, run `npm run dev-web`. This will generate routes and the Orval types to call the backend

```
cd apps/web
npm install
cd ../..
npm run dev-web
```

### Supabase

From the root dir, run

```
supabase start
```

this **should** start the local supabase server and show you the env vars you need.

## Features

List of features that would be cool to exist in some way

- Creation of flash cards using markdown for front and back
- authentication with oauth
- main Spaced Repetition System study mode to effectively learn content
- adding other public cards from other users to your own deck
- copying other's decks to study (like quizlet)
- uploading of lecture slides or similar content, using AI to automatically make cards from content
- cram study mode (doesn't use SRS)
- creation of notes from lecture audio (creates transcript)
- importing of decks from anki and/or quizlet
- review heat map to show off to others
- play audio for front and/or back of card
- embed media in card
- Study group so you and your friends can study the same flashcards or set of flashcards
- Flashcards leaderboards for study groups and the flashcard set in general
- Different study modes like a timed mode with different speeds
- Ability to study multiple sets at the same time ie studying cards for Chinese 1, Chinese 2, and Chinese 3 in one sitting
- Turn flashcards into an "exam" like option to give people another way to study. This would probably be just the front of the flash card and the user would have to type the back.

## Tech stack

May change, but will probably be something like this:

- Laravel (api)
- React (web)
- Postgres
- Swift (if mobile)
