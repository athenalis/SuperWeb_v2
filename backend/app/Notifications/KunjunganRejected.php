<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class KunjunganRejected extends Notification
{
    use Queueable;

    protected $visit;
    protected $message;

    /**
     * Create a new notification instance.
     */
    public function __construct($visit, $message)
    {
        $this->visit = $visit;
        $this->message = $message;
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
            'visit_name' => $this->visit->nama,
            'message' => $this->message,
            'type' => 'visit_rejected',
            'status' => 'rejected'
        ];
    }
}
