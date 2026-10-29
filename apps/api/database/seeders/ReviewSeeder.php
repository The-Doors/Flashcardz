<?php

namespace Database\Seeders;

use App\Models\Card;
use App\Services\Fsrs\Card as FsrsCard;
use App\Services\Fsrs\Rating;
use App\Services\Fsrs\Scheduler;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class ReviewSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(Scheduler $scheduler): void
    {
        Card::doesntHave('reviews')->whereHas('deck')->with('deck')->each(function (Card $card) use ($scheduler): void {
            [$scheduled, $log] = $scheduler->reviewCard(new FsrsCard(cardId: $card->id), Rating::Good, CarbonImmutable::now('UTC'));
            $review = $card->reviews()->make([
                'rating' => $log->rating,
                'review_datetime' => $log->reviewDateTime,
                'state' => $scheduled->state,
                'step' => $scheduled->step,
                'stability' => $scheduled->stability,
                'difficulty' => $scheduled->difficulty,
                'due' => $scheduled->due,
            ]);
            $review->user()->associate($card->deck->user_id);
            $review->save();
        });
    }
}
