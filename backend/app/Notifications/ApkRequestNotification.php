<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\ApkRequest;

class ApkRequestNotification extends Notification
{
    use Queueable;

    protected string $type;
    protected ApkRequest $apkRequest;
    protected ?string $message;

    /**
     * Create a new notification instance.
     *
     * @param string $type - apk_request, apk_request_approved, apk_request_rejected
     * @param ApkRequest $apkRequest
     * @param string|null $message - optional feedback message
     */
    public function __construct(string $type, ApkRequest $apkRequest, ?string $message = null)
    {
        $this->type = $type;
        $this->apkRequest = $apkRequest;
        $this->message = $message;
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
        $requestNo = $this->apkRequest->request_no ?? '#' . $this->apkRequest->id;
        $coordinatorName = $this->apkRequest->coordinator?->nama ?? 'Koordinator';

        $courierName = $this->apkRequest->courier?->nama ?? null;
        $courierPhone = $this->apkRequest->courier?->no_hp ?? null;

        $approvedMsg = "Permintaan APK {$requestNo} telah disetujui.";
        if ($courierName) {
            $approvedMsg .= " Kurir {$courierName} akan segera mengantar (No. HP: {$courierPhone}).";
        }

        $messages = [
            'apk_request' => "Permintaan APK baru ({$requestNo}) dari {$coordinatorName}",
            'apk_request_approved' => $approvedMsg,
            'apk_request_rejected' => "Permintaan APK {$requestNo} ditolak. " . ($this->message ?? 'Silakan revisi dan kirim ulang.'),
            'apk_request_revised' => "Permintaan APK {$requestNo} telah direvisi oleh {$coordinatorName}",
            'apk_request_assigned' => "Tugas Baru: Pengiriman APK {$requestNo} ke {$coordinatorName}",
            'apk_request_picked_up' => "Barang untuk permintaan {$requestNo} sudah diambil kurir",
            'apk_request_arrived' => "Barang untuk permintaan {$requestNo} sudah sampai tujuan",
            'apk_request_delivered' => "Barang untuk permintaan {$requestNo} telah diterima",
        ];

        // Tentukan URL aksi
        $actionUrl = match($this->type) {
             'apk_request', 'apk_request_revised', 'apk_request_delivered', 'apk_request_assigned' => "/inbox",
             default => "/permintaan-apk?id={$this->apkRequest->id}" 
        };

        return [
            'type' => $this->type,
            'message' => $messages[$this->type] ?? "Update permintaan APK {$requestNo}",
            'apk_request_id' => $this->apkRequest->id,
            'request_no' => $requestNo,
            'coordinator_id' => $this->apkRequest->coordinator_id,
            'coordinator_name' => $coordinatorName,
            'status' => $this->apkRequest->status?->code,
            'feedback' => $this->message,
            'courier_name' => $courierName,
            'courier_phone' => $courierPhone,
            'action_url' => $actionUrl,
        ];
    }
}