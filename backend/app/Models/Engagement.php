<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Engagement extends Model
{
    protected $table = 'engagements';

    protected $fillable = [
        'content_platform_id',
        'likes',
        'views',
        'start_date',
        'end_date',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function contentPlatform()
    {
        return $this->belongsTo(ContentPlatform::class);
    }
}
