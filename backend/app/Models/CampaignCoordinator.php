<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CampaignCoordinator extends Model
{
    protected $table = 'campaign_coordinators';

    public $timestamps = false;

    protected $fillable = ['campaign_id', 'koordinator_id'];

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function koordinator()
    {
        return $this->belongsTo(Coordinator::class);
    }
}
