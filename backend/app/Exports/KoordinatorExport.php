<?php

namespace App\Exports;

use App\Models\Coordinator;
use App\Models\UserCredential;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use Illuminate\Support\Facades\Crypt;


class KoordinatorExport implements FromCollection, WithHeadings, ShouldAutoSize, WithEvents
{
    public function collection()
    {
        return Coordinator::with(['user', 'village'])
            ->whereHas('user')
            ->get()
            ->map(function ($koor) {

                $credential = UserCredential::where('user_id', $koor->user->id)
                    ->where('is_active', true)
                    ->first();

                return [
                    'nama_koordinator' => $koor->nama,
                    'email' => $koor->user->email,
                    'password' => $credential
                        ? Crypt::decryptString($credential->encrypted_password)
                        : '-',
                    'no_hp' => $koor->no_hp,
                    'kelurahan' => $koor->village?->village,
                ];
            })
            ->values();
    }

    public function headings(): array
    {
        return ['Nama', 'Email', 'Password', 'No HP', 'Kelurahan'];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                // HEADER BOLD
                $event->sheet->getStyle('A1:E1')->getFont()->setBold(true);
                
                // Optional: wrap text
                $event->sheet->getStyle('A:E')->getAlignment()->setWrapText(true);
            },
        ];
    }
}
