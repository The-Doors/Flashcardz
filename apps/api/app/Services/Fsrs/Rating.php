<?php

namespace App\Services\Fsrs;

enum Rating: int
{
    case Again = 1;
    case Hard = 2;
    case Good = 3;
    case Easy = 4;
}
