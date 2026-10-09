# Flashcardz

(WIP) Don't worry about it

## Installation

Prerequisites:

- python
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [node](https://nodejs.org/en/download)
- [supabase cli](https://supabase.com/docs/guides/local-development/cli/getting-started)

### Api

(def could change, i dont totally get fastapi)

```
cd apps/api
uv run fastapi dev src/main.py --app app
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

- Fastapi (api)
- React (web)
- Postgres
- Swift (if mobile)
