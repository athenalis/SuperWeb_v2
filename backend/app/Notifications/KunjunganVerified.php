<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class KunjunganVerified extends Notification
{
    use Queueable;

    public $visit;

    public function __construct($visit)
    {
        $this->visit = $visit;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toArray($notifiable)
    {
        return [
            'visit_id' => $this->visit->id,
            'visit_name' => $this->visit->nama,
            'message' => "Kunjungan '{$this->visit->nama}' telah diverifikasi dan disetiujui.",
            'type' => 'visit_verified',
            'status' => 'accepted'
        ];
    }
}
