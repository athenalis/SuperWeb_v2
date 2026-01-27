<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContentTypePlatform extends Model
{
    protected $table = 'content_type_platform';

    protected $fillable = [
        'content_type_id',
        'platform_id',
    ];

    public $timestamps = false;

    /* ======================
        RELATION
    ====================== */

    public function contentType()
    {
        return $this->belongsTo(ContentType::class);
    }

    public function platform()
    {
        return $this->belongsTo(Platform::class);
    }
}
