<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\VisitForm;

class KunjunganNeedsRevision extends Notification
{
    use Queueable;

    protected $kunjungan;
    protected $komentar;

    /**
     * Create a new notification instance.
     */
    public function __construct(VisitForm $kunjungan, $komentar = '')
    {
        $this->kunjungan = $kunjungan;
        $this->komentar = $komentar;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray(object $notifiable): array
    {
        $message = "Kunjungan '{$this->kunjungan->nama}' perlu direvisi.";
        if ($this->komentar) {
            $message .= " Catatan: {$this->komentar}";
        }

        return [
            'type' => 'visit_needs_revision',
            'message' => $message,
            'kunjungan_id' => $this->kunjungan->id,
            'kunjungan_nama' => $this->kunjungan->nama,
            'komentar' => $this->komentar,
            'redirect_url' => "/kunjungan/{$this->kunjungan->id}/edit"
        ];
    }
}
