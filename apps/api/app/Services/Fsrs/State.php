<?php

namespace App\Services\Fsrs;

enum State: int
{
    case Learning = 1;
    case Review = 2;
    case Relearning = 3;
}
