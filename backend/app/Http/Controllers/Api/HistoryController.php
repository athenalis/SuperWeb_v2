<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\History;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class HistoryController extends Controller
{
    private function userRoleSlug($user): ?string
    {
        return DB::table('roles')->where('id', $user->role_id)->value('role');
    }

    private function actorLabelFromHistory($history): string
    {
        $role = $history->role ?? '-';
        $name = optional($history->user)->name ?? 'User';
        return "{$role} ({$name})";
    }

    private function targetLabel(?string $targetType): string
    {
        return match ($targetType) {
            'admin_paslon' => 'Admin Paslon',
            'admin_apk' => 'Admin APK',
            'apk_koordinator' => 'Koordinator APK',
            'coordinator_apk' => 'Koordinator APK',
            'kunjungan_koordinator' => 'Koordinator Kunjungan',
            'koordinator' => 'Koordinator Kunjungan',
            'relawan' => 'Relawan',
            'apk_kurir' => 'Kurir APK',
            default => $targetType ?? '-',
        };
    }

    private function niceField(string $field): string
    {
        return match ($field) {
            'nama' => 'nama',
            'nik' => 'NIK',
            'no_hp' => 'no HP',
            'alamat' => 'alamat',
            'tps' => 'TPS',
            'ormas_id' => 'ormas',
            'province_code' => 'provinsi',
            'city_code' => 'kota',
            'district_code' => 'kecamatan',
            'village_code' => 'kelurahan',
            'paslon_id' => 'paslon',
            'status' => 'status',
            'is_kunjungan' => 'tugas kunjungan',
            'is_apk' => 'tugas APK',
            default => $field,
        };
    }

    private function readMeta($history): array
    {
        $meta = $history->meta ?? [];
        if (is_string($meta)) {
            $decoded = json_decode($meta, true);
            return is_array($decoded) ? $decoded : [];
        }
        return is_array($meta) ? $meta : [];
    }

    private function resolvePaslonIdForActor($actor, string $roleSlug): ?int
    {
        return match ($roleSlug) {
            'admin_paslon' => (int) (DB::table('admin_paslons')->where('user_id', $actor->id)->whereNull('deleted_at')->value('paslon_id') ?? 0),
            'admin_apk' => (int) (DB::table('admin_apks')->where('user_id', $actor->id)->whereNull('deleted_at')->value('paslon_id') ?? 0),
            'apk_koordinator' => (int) (DB::table('apk_koordinators')->where('user_id', $actor->id)->whereNull('deleted_at')->value('paslon_id') ?? 0),
            'kunjungan_koordinator' => (int) (DB::table('coordinator_visits')->where('user_id', $actor->id)->whereNull('deleted_at')->value('paslon_id') ?? 0),
            default => null,
        } ?: null;
    }

    private function buildMessage($history): string
    {
        $action = strtoupper((string) ($history->action ?? ''));
        $targetType = (string) ($history->target_type ?? '');
        $targetName = (string) ($history->target_name ?? '');
        $field = (string) ($history->field ?? '');
        $old = (string) ($history->old_value ?? '');
        $new = (string) ($history->new_value ?? '');

        $actorLabel  = $this->actorLabelFromHistory($history);
        $targetLabel = $this->targetLabel($targetType);
        $meta = $this->readMeta($history);

        if ($action === 'CREATE') {
            if (!empty($meta)) {
                $wil = [];
                if (!empty($meta['kelurahan'])) $wil[] = "Kel. {$meta['kelurahan']}";
                if (!empty($meta['kecamatan'])) $wil[] = "Kec. {$meta['kecamatan']}";
                if (!empty($meta['kota'])) $wil[] = "Kota {$meta['kota']}";
                if (!empty($meta['provinsi'])) $wil[] = "Prov. {$meta['provinsi']}";

                $tugas = '';
                if (isset($meta['tugas']) && is_array($meta['tugas'])) {
                    $kunj = (int) ($meta['tugas']['kunjungan'] ?? 0);
                    $apk  = (int) ($meta['tugas']['apk'] ?? 0);
                    $tugas = " (tugas: " . trim(($kunj ? 'kunjungan ' : '') . ($apk ? 'apk' : '')) . ")";
                }

                $suffix = !empty($wil) ? ' - ' . implode(', ', $wil) : '';
                return "{$actorLabel} menambahkan {$targetLabel} {$targetName}{$tugas}{$suffix}";
            }

            return "{$actorLabel} menambahkan {$targetLabel} {$targetName}";
        }

        if ($action === 'DELETE') {
            $hard = (bool)($meta['hard_delete'] ?? false);
            $extra = $hard ? ' (hapus permanen)' : '';
            return "{$actorLabel} menghapus {$targetLabel} {$targetName}{$extra}";
        }

        if ($action === 'RESTORE') {
            if ($field === 'activate_nik') {
                return "{$actorLabel} mengaktifkan kembali {$targetLabel} {$targetName}";
            }
            return "{$actorLabel} mengembalikan {$targetLabel} {$targetName}";
        }

        if ($action === 'EXPORT') {
            return "{$actorLabel} melakukan export data {$targetLabel}";
        }

        if ($action === 'IMPORT') {
            $jumlah = $meta['jumlah_data'] ?? $meta['successCount'] ?? $meta['total'] ?? null;
            $suffix = $jumlah !== null ? " ({$jumlah} data)" : '';
            return "{$actorLabel} melakukan import data {$targetLabel}{$suffix}";
        }

        if ($action === 'UPDATE') {
            if ($field === '') {
                return "{$actorLabel} memperbarui {$targetLabel} {$targetName}";
            }

            $nice = $this->niceField($field);

            if ($field === 'status') {
                return "{$actorLabel} mengubah status {$targetLabel} {$targetName} dari {$old} menjadi {$new}";
            }

            if ($field === 'is_kunjungan' || $field === 'is_apk') {
                $from = ((int)$old) === 1 ? 'aktif' : 'nonaktif';
                $to   = ((int)$new) === 1 ? 'aktif' : 'nonaktif';
                return "{$actorLabel} mengubah {$nice} {$targetLabel} {$targetName} dari {$from} menjadi {$to}";
            }

            return "{$actorLabel} mengubah {$nice} {$targetLabel} {$targetName} dari '{$old}' menjadi '{$new}'";
        }

        if ($targetName !== '') {
            return "{$actorLabel} melakukan {$action} pada {$targetLabel} {$targetName}";
        }
        return "{$actorLabel} melakukan {$action} pada {$targetLabel}";
    }

    public function index(Request $request)
    {
        $actor = Auth::user();
        $roleSlug = $this->userRoleSlug($actor);

        $allowed = [
            'superadmin',
            'admin_paslon',
            'admin_apk',
            'kunjungan_koordinator',
            'apk_koordinator',
        ];

        if (!in_array($roleSlug, $allowed, true)) {
            return response()->json([
                'status' => false,
                'message' => 'Anda tidak memiliki akses melihat history'
            ], 403);
        }

        $query = History::query()
            ->with(['user:id,name'])
            ->orderByDesc('id');

        if ($request->filled('action')) {
            $query->where('action', strtoupper($request->action));
        }
        if ($request->filled('target_type')) {
            $query->where('target_type', $request->target_type);
        }
        if ($request->filled('search')) {
            $kw = $request->search;
            $query->where(function ($q) use ($kw) {
                $q->where('target_name', 'like', "%{$kw}%")
                    ->orWhere('target_type', 'like', "%{$kw}%")
                    ->orWhere('action', 'like', "%{$kw}%")
                    ->orWhere('role', 'like', "%{$kw}%");
            });
        }

        if ($roleSlug !== 'superadmin') {
            $paslonId = $this->resolvePaslonIdForActor($actor, $roleSlug);

            if (!$paslonId) {
                return response()->json([
                    'status' => false,
                    'message' => 'Paslon tidak ditemukan untuk akun ini'
                ], 403);
            }

            if (Schema::hasColumn('histories', 'paslon_id')) {
                $query->where('paslon_id', (int) $paslonId);
            } else {
                $query->whereRaw("JSON_EXTRACT(meta, '$.paslon_id') = ?", [(int) $paslonId]);
            }
        }

        $limit = $request->filled('limit') ? max(1, (int)$request->limit) : 200;
        $data = $query->limit($limit)->get();

        $data->transform(function ($item) {
            $item->message = $this->buildMessage($item);
            return $item;
        });

        return response()->json([
            'status' => true,
            'data' => $data,
        ]);
    }
}
