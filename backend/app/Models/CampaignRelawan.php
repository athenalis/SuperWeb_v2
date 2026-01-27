<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CampaignRelawan extends Model
{
    public $timestamps = false;

    protected $fillable = ['campaign_id', 'relawan_id', 'total_tugas', 'progress'];
    protected $table = 'campaign_relawans';

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function relawan()
    {
        return $this->belongsTo(Relawan::class);
    }
}
