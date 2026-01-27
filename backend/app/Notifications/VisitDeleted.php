<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VisitDeleted extends Notification
{
    use Queueable;

    protected $visitName;
    protected $relawanName;
    protected $deleterRole;

    /**
     * Create a new notification instance.
     */
    public function __construct($visitName, $relawanName, $deleterRole)
    {
        $this->visitName = $visitName;
        $this->relawanName = $relawanName;
        $this->deleterRole = $deleterRole;
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
            'title' => 'Kunjungan Dihapus',
            'message' => "Relawan {$this->relawanName} menghapus kunjungan {$this->visitName}.",
            'type' => 'visit_deleted',
            'redirect_url' => null // No redirect since it's deleted
        ];
    }
}
