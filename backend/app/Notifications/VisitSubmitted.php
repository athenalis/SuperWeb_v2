<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VisitSubmitted extends Notification
{
    use Queueable;

    protected $visit;
    protected $relawan;

    /**
     * Create a new notification instance.
     */
    public function __construct($visit, $relawan)
    {
        $this->visit = $visit;
        $this->relawan = $relawan;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'visit_id' => $this->visit->id,
            'kunjungan_id' => $this->visit->id, // For frontend compatibility
            'relawan_id' => $this->relawan->id,
            'relawan_name' => $this->relawan->nama,
            'visit_name' => $this->visit->nama,
            'message' => "Relawan {$this->relawan->nama} telah menyelesaikan kunjungan lapangan untuk {$this->visit->nama}.",
            'redirect_url' => "/kunjungan/{$this->visit->id}",
            'type' => 'new_visit'
        ];
    }
}
