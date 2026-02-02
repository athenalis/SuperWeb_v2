<?php

namespace App\Models;

use App\Models\ApkItem;
use Illuminate\Database\Eloquent\Model;

class ApkRequestItem extends Model
{
    protected $table = 'apk_request_items';

    protected $fillable = [
        'apk_request_id',
        'item_id',
        'qty',
        'unit_id',
        'note',
    ];

    public function request()
    {
        return $this->belongsTo(ApkRequest::class, 'apk_request_id');
    }

    public function item()
    {
        return $this->belongsTo(ApkItem::class, 'item_id'); // model master item kamu
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }
}
