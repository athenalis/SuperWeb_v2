<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InfluencerPlatform extends Model
{
    protected $table = 'influencer_platforms';
    public $timestamps = false;

    protected $fillable = [
        'influencer_id',
        'platform_id',
        'username',
        'followers',
    ];

    public function platform()
    {
        return $this->belongsTo(Platform::class, 'platform_id');
    }

    public function influencer()
    {
        return $this->belongsTo(Influencer::class, 'influencer_id');
    }
}
