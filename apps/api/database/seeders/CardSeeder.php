<?php

namespace Database\Seeders;

use App\Models\Card;
use App\Models\Deck;
use Illuminate\Database\Seeder;

class CardSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Deck::query()->each(fn (Deck $deck) => Card::factory()->count(5)->for($deck)->create());
    }
}
