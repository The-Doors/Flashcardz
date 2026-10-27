"""Regenerate with: python3 generate.py /path/to/py-fsrs

Reference: open-spaced-repetition/py-fsrs at
9446cb06605c597a063aeee49f7d188d42e34dc2 (MIT).
Only the upstream scheduler produces expected values. Not needed to run PHP tests.
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, sys.argv[1])

import fsrs.scheduler as upstream
from fsrs import Card, Rating, ReviewLog, Scheduler, State

COMMIT = "9446cb06605c597a063aeee49f7d188d42e34dc2"
NOW = datetime(2022, 11, 29, 12, 30, tzinfo=timezone.utc)
cases = {}


def review(name, card, rating, at=NOW, sample=None, **options):
    scheduler = Scheduler(enable_fuzzing=sample is not None, **options)
    if sample is not None:
        upstream.random = lambda: sample
    updated, log = scheduler.review_card(card, rating, at, review_duration=1234)
    config = scheduler.to_dict()
    # Upstream serialization truncates steps to seconds; preserve runtime precision here.
    config["learning_steps"] = [step.total_seconds() for step in scheduler.learning_steps]
    config["relearning_steps"] = [step.total_seconds() for step in scheduler.relearning_steps]
    cases[name] = {
        "scheduler": config,
        "card": card.to_dict(),
        "rating": int(rating),
        "at": at.isoformat(),
        "sample": sample,
        "expected_card": updated.to_dict(),
        "expected_log": log.to_dict(),
        "retrievability": scheduler.get_card_retrievability(
            updated, at + timedelta(days=3, hours=23)
        ),
    }


for rating in Rating:
    review(f"new-{rating.name}", Card(card_id=1, due=NOW), rating)

for state, step in [(State.Learning, 0), (State.Learning, 1), (State.Review, None), (State.Relearning, 0), (State.Relearning, 1)]:
    for delay in [-1, 0, 86_399_999_999, 86_400_000_000, 86_400_000_001, 21 * 86_400_000_000]:
        for rating in Rating:
            card = Card(card_id=2, state=state, step=step, stability=12.3, difficulty=6.4, due=NOW, last_review=NOW)
            review(f"{state.name}-step{step}-{delay}us-{rating.name}", card, rating,
                   NOW + timedelta(microseconds=delay), relearning_steps=[timedelta(seconds=60), timedelta(seconds=600)])

for state in [State.Learning, State.Relearning]:
    for seconds in [[], [600], [60, 600], [60, 600, 3600], [0.000001, 1.000002]]:
        for step in [0, 1, 3]:
            for rating in Rating:
                card = Card(card_id=3, state=state, step=step, stability=12.3, difficulty=6.4, due=NOW, last_review=NOW)
                key = "learning_steps" if state == State.Learning else "relearning_steps"
                review(f"{state.name}-steps{seconds}-step{step}-{rating.name}", card, rating,
                       **{key: [timedelta(seconds=s) for s in seconds]})

for rating in Rating:
    for state in State:
        card = Card(card_id=4, state=state, step=0 if state != State.Review else None,
                    stability=0.001, difficulty=10, due=NOW)
        review(f"{state.name}-no-last-review-{rating.name}", card, rating)
    for missing in ["stability", "difficulty"]:
        card = Card(card_id=5, stability=12.3, difficulty=6.4, due=NOW, last_review=NOW)
        setattr(card, missing, None)
        review(f"learning-missing-{missing}-{rating.name}", card, rating)
    review(f"review-no-relearning-{rating.name}", Card(card_id=6, state=State.Review, stability=12.3,
           difficulty=6.4, due=NOW, last_review=NOW - timedelta(days=20)), rating, relearning_steps=[])

for retention in [0.75, 0.95, 1.0]:
    for rating in Rating:
        review(f"retention{retention}-{rating.name}", Card(card_id=7, due=NOW), rating,
               learning_steps=[], desired_retention=retention)

for maximum in [1, 2, 7, 100]:
    for rating in Rating:
        review(f"maximum{maximum}-{rating.name}", Card(card_id=8, state=State.Review, stability=5000,
               difficulty=1, last_review=NOW - timedelta(days=100), due=NOW), rating,
               maximum_interval=maximum, relearning_steps=[])

parameters = list(upstream.DEFAULT_PARAMETERS)
parameters[:4] = [2.5, 3.5, 8.5, 9.5]
for rating in Rating:
    review(f"rounding-{rating.name}", Card(card_id=9, due=NOW), rating, parameters=parameters, learning_steps=[])

custom = [0.1456, 0.4186, 1.1104, 4.1315, 5.2417, 1.3098, 0.8975, 0.001,
          1.5674, 0.0567, 0.9661, 2.0275, 0.1592, 0.2446, 1.5071, 0.2272,
          2.8755, 1.234, 0.56789, 0.1437, 0.2]
for rating in Rating:
    for state in State:
        review(f"custom-{state.name}-{rating.name}", Card(card_id=10, state=state,
               step=0 if state != State.Review else None, stability=12.3, difficulty=6.4,
               last_review=NOW - timedelta(days=20), due=NOW), rating, parameters=custom)

for name, parameters in [("lower", upstream.LOWER_BOUNDS_PARAMETERS), ("upper", upstream.UPPER_BOUNDS_PARAMETERS)]:
    for rating in Rating:
        review(f"weight-boundary-{name}-new-{rating.name}", Card(card_id=14, due=NOW), rating,
               parameters=parameters, learning_steps=[])
        review(f"weight-boundary-{name}-review-{rating.name}", Card(card_id=14, state=State.Review,
               stability=50, difficulty=6.4, last_review=NOW - timedelta(days=100), due=NOW), rating,
               parameters=parameters, relearning_steps=[])

review("default-maximum-interval", Card(card_id=15, state=State.Review, stability=100000,
       difficulty=1, last_review=NOW - timedelta(days=100), due=NOW), Rating.Easy)

for days in [1, 2, 3, 6, 7, 8, 19, 20, 21, 50, 100]:
    for sample in [0.0, 0.25, 0.5, 0.75, 0.9999999999999999]:
        parameters = list(upstream.DEFAULT_PARAMETERS)
        parameters[2] = float(days)
        review(f"fuzz-{days}days-{sample}", Card(card_id=11, due=NOW), Rating.Good,
               parameters=parameters, learning_steps=[], sample=sample)

for maximum in [1, 2, 3, 7, 20]:
    for sample in [0.0, 0.5, 0.9999999999999999]:
        review(f"fuzz-maximum{maximum}-{sample}", Card(card_id=12, state=State.Review,
               stability=5000, difficulty=1, last_review=NOW - timedelta(days=100), due=NOW),
               Rating.Easy, maximum_interval=maximum, sample=sample)

for state in [State.Learning, State.Relearning]:
    review(f"no-fuzz-{state.name}", Card(card_id=13, state=state, step=0, stability=12.3,
           difficulty=6.4, due=NOW, last_review=NOW), Rating.Hard, sample=0.5)

traces = {}
for name, ratings, delays in [
    ("upstream-interval-history", [3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3], None),
    ("upstream-memory-state", [1, 3, 3, 3, 3, 3], [0, 0, 1, 3, 8, 21]),
    ("repeated-easy-microseconds", [4] * 10, [0] * 10),
    ("repeated-lapses", [1] * 50, [1] * 50),
]:
    scheduler = Scheduler(enable_fuzzing=False)
    card = Card(card_id=20, due=NOW)
    records = []
    at = NOW
    logs = []
    for index, value in enumerate(ratings):
        if delays is not None:
            at += timedelta(days=delays[index], microseconds=1 if name == "repeated-easy-microseconds" else 0)
        card, log = scheduler.review_card(card, Rating(value), at)
        records.append({"rating": value, "at": at.isoformat(), "expected_card": card.to_dict()})
        logs.append(log)
        if delays is None:
            at = card.due
    traces[name] = {"initial_card": Card(card_id=20, due=NOW).to_dict(), "records": records}
    if name == "upstream-interval-history":
        history_card, history_logs = card, logs

reschedules = {}
for name, options in [("same", {}), ("parameters", {"parameters": custom}),
                      ("retention", {"desired_retention": 0.85}),
                      ("steps", {"learning_steps": [timedelta(seconds=60)]})]:
    scheduler = Scheduler(enable_fuzzing=False, **options)
    reschedules[name] = {
        "scheduler": scheduler.to_dict(), "card": history_card.to_dict(),
        "logs": [log.to_dict() for log in reversed(history_logs)],
        "expected_card": scheduler.reschedule_card(history_card, history_logs).to_dict(),
    }
reschedules["empty"] = {"scheduler": scheduler.to_dict(), "card": history_card.to_dict(), "logs": [],
                        "expected_card": scheduler.reschedule_card(history_card, []).to_dict()}

retrievabilities = {}
for state in State:
    for missing in [None, "last_review", "stability"]:
        for elapsed in [-1, 0, 86_399_999_999, 86_400_000_000, 86_400_000_001, 20 * 86_400_000_000]:
            card = Card(card_id=30, state=state, stability=20, difficulty=6, due=NOW, last_review=NOW)
            if missing:
                setattr(card, missing, None)
            at = NOW + timedelta(microseconds=elapsed)
            retrievabilities[f"{state.name}-{missing}-{elapsed}us"] = {
                "card": card.to_dict(), "at": at.isoformat(),
                "expected": Scheduler().get_card_retrievability(card, at),
            }

fixture = {"source": f"https://github.com/open-spaced-repetition/py-fsrs/tree/{COMMIT}",
           "scheduler": Scheduler().to_dict(), "reviews": cases, "traces": traces,
           "reschedules": reschedules, "retrievabilities": retrievabilities}
sections = []
for name, value in fixture.items():
    entries = [f"    {json.dumps(key)}: {json.dumps(case)}" for key, case in value.items()] if isinstance(value, dict) else None
    sections.append(f"  {json.dumps(name)}: {{\n" + ",\n".join(entries) + "\n  }" if entries else f"  {json.dumps(name)}: {json.dumps(value)}")
Path(__file__).with_name("parity.json").write_text("{\n" + ",\n".join(sections) + "\n}\n")
print(f"Generated {len(cases)} reviews, {len(traces)} traces, {len(reschedules)} reschedules, {len(retrievabilities)} retrievabilities")
