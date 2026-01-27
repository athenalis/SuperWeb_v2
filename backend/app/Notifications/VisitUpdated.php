<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VisitUpdated extends Notification
{
    use Queueable;

    public $visitForm;
    public $updater;

    /**
     * Create a new notification instance.
     */
    public function __construct($visitForm, $updater)
    {
        $this->visitForm = $visitForm;
        $this->updater = $updater;
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
            'title' => 'Data Kunjungan Diperbarui',
            'message' => "Data kunjungan {$this->visitForm->nama} telah diperbarui oleh {$this->updater->name}.",
            'visit_id' => $this->visitForm->id,
            'kunjungan_id' => $this->visitForm->id, // For frontend compatibility
            'updater_id' => $this->updater->id,
            'relawan_id' => $this->visitForm->relawan_id,
            'redirect_url' => "/verifikasi?relawan_id={$this->visitForm->relawan_id}&status=pending",
            'type' => 'visit_updated'
        ];
    }
}
