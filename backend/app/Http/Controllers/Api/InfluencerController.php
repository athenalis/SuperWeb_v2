<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Influencer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;


class InfluencerController extends Controller
{
    private const PLATFORM_CODE_TO_NAME = [
        'ig' => 'Instagram',
        'yt' => 'YouTube',
        'tt' => 'TikTok',
        'fb' => 'Facebook',
        'x'  => 'X',
    ];

    private function normalizeContactsInput($contacts)
    {
        if (is_string($contacts)) {
            $contacts = array_map('trim', explode(',', $contacts));
        }

        if (!is_array($contacts)) {
            return [];
        }

        return array_values(array_filter($contacts));
    }

    public function index(Request $request)
    {
        $platformIds = $request->input('platform_ids', []);
        $search = $request->input('search');
        $perPage = $request->input('per_page', 5);

        $query = Influencer::with(['platforms.platform']);
        
        $platform = $request->input('platform');

        if ($platform) {
            $query->whereHas('platforms.platform', function ($q) use ($platform) {
                $q->where('name', $platform);
            });
        }

        if ($platform && isset(self::PLATFORM_CODE_TO_NAME[$platform])) {
            $platformName = self::PLATFORM_CODE_TO_NAME[$platform];

            $query->whereHas('platforms.platform', function ($q) use ($platformName) {
                $q->where('name', $platformName);
            });
        }

        if (!empty($platformIds)) {
            $query->whereHas('platforms', function ($q) use ($platformIds) {
                $q->whereIn('platform_id', $platformIds);
            });
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('platforms', function ($p) use ($search) {
                        $p->where('username', 'like', "%{$search}%");
                    });
            });
        }

        $influencers = $query->paginate($perPage);

        $influencers->getCollection()->transform(function ($influencer) {
            return [
                'id' => $influencer->id,
                'name' => $influencer->name,
                'email' => $influencer->email,
                'contacts' => $influencer->contacts,
                'platforms' => $influencer->platforms->map(function ($p) {
                    return [
                        'id' => $p->platform_id,
                        'name' => $p->platform->name,
                        'username' => $p->username,
                        'followers' => $p->followers,
                    ];
                }),
                'display_name' => $this->makeDisplayName($influencer),
            ];
        });

        return response()->json($influencers);
    }

    /**
     * Optional helper buat label dropdown
     */
    protected function makeDisplayName($influencer)
    {
        if ($influencer->platforms->isEmpty()) {
            return $influencer->name;
        }

        $platformInfo = $influencer->platforms->map(function ($p) {
            return "{$p->username} ({$p->platform->name})";
        })->implode(', ');

        return "{$influencer->name} — {$platformInfo}";
    }

    public function store(Request $request)
    {
        if ($request->has('contacts')) {
            $request->merge([
                'contacts' => $this->normalizeContactsInput($request->contacts),
            ]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',

            'email' => 'nullable|email|max:255|required_without:contacts',
            'contacts' => 'nullable|array|required_without:email',
            'contacts.*' => 'string|max:25',

            'platforms' => 'required|array|min:1',
            'platforms.*.platform_id' => 'required|exists:platforms,id',
            'platforms.*.username' => 'required|string|max:255',
            'platforms.*.followers' => 'nullable|numeric|min:0',
        ]);

        $hasEmail = !empty($validated['email']);
        $hasContacts = !empty($validated['contacts']) && count($validated['contacts']) > 0;

        if (!$hasEmail && !$hasContacts) {
            return response()->json([
                'message' => 'Minimal harus mengisi email atau nomor telepon'
            ], 422);
        }

        $contacts = [];
        if ($hasContacts) {
            foreach ($validated['contacts'] as $phone) {
                $phone = preg_replace('/[^0-9]/', '', $phone);

                if (str_starts_with($phone, '0')) {
                    $phone = '62' . substr($phone, 1);
                }

                if (!str_starts_with($phone, '62')) {
                    $phone = '62' . $phone;
                }

                $contacts[] = '+' . $phone;
            }
        }

        DB::beginTransaction();

        try {
            $influencer = Influencer::create([
                'name' => $validated['name'],
                'email' => $validated['email'] ?? null,
                'contacts' => $contacts,
            ]);

            foreach ($validated['platforms'] as $platform) {
                $influencer->platforms()->create([
                    'platform_id' => $platform['platform_id'],
                    'username' => $platform['username'],
                    'followers' => $platform['followers'] ?? 0,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Influencer berhasil ditambahkan',
                'data' => $influencer->load('platforms.platform'),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menambahkan influencer',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        if ($request->has('contacts')) {
            $request->merge([
                'contacts' => $this->normalizeContactsInput($request->contacts),
            ]);
        }
        $influencer = Influencer::with('platforms')->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',

            'email' => 'nullable|email|max:255|required_without:contacts',
            'contacts' => 'nullable|array|required_without:email',
            'contacts.*' => 'string|max:25',

            'platforms' => 'required|array|min:1',
            'platforms.*.platform_id' => 'required|exists:platforms,id',
            'platforms.*.username' => 'required|string|max:255',
            'platforms.*.followers' => 'nullable|numeric|min:0',
        ]);

        $hasEmail = !empty($validated['email']);
        $hasContacts = !empty($validated['contacts']) && count($validated['contacts']) > 0;

        if (!$hasEmail && !$hasContacts) {
            return response()->json([
                'message' => 'Mohon lengkapi salah satu kontak: email atau nomor telepon'
            ], 422);
        }

        // Normalisasi kontak
        $contacts = [];
        if ($hasContacts) {
            foreach ($validated['contacts'] as $phone) {
                $phone = preg_replace('/[^0-9]/', '', $phone);

                if (str_starts_with($phone, '0')) {
                    $phone = '62' . substr($phone, 1);
                }

                if (!str_starts_with($phone, '62')) {
                    $phone = '62' . $phone;
                }

                $contacts[] = '+' . $phone;
            }
        }

        DB::beginTransaction();

        try {
            /** ================= UPDATE MAIN DATA ================= */
            $influencer->update([
                'name' => $validated['name'],
                'email' => $validated['email'] ?? null,
                'contacts' => $contacts,
            ]);

            /** ================= SYNC PLATFORMS ================= */
            // Hapus platform lama
            $influencer->platforms()->delete();

            // Insert ulang platform baru
            foreach ($validated['platforms'] as $platform) {
                $influencer->platforms()->create([
                    'platform_id' => $platform['platform_id'],
                    'username' => $platform['username'],
                    'followers' => $platform['followers'] ?? 0,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Influencer berhasil diperbarui',
                'data' => $influencer->load('platforms.platform'),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Gagal memperbarui influencer',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    public function all(Request $request)
    {
        $platformIds = $request->input('platform_ids', []);
        $search = $request->input('search');

        $query = Influencer::with(['platforms.platform']);

        if (!empty($platformIds)) {
            $query->whereHas('platforms', function ($q) use ($platformIds) {
                $q->whereIn('platform_id', $platformIds);
            });
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('platforms', function ($p) use ($search) {
                        $p->where('username', 'like', "%{$search}%");
                    });
            });
        }

        $influencers = $query->get();

        $influencers = $influencers->map(function ($influencer) {
            return [
                'id' => $influencer->id,
                'name' => $influencer->name,
                'email' => $influencer->email,
                'contacts' => $influencer->contacts,
                'platforms' => $influencer->platforms->map(function ($p) {
                    return [
                        'id' => $p->platform_id,
                        'name' => $p->platform->name,
                        'username' => $p->username,
                        'followers' => $p->followers,
                    ];
                }),
                'display_name' => $this->makeDisplayName($influencer),
            ];
        });

        return response()->json([
            'success' => true,
            'total' => $influencers->count(),
            'data' => $influencers
        ]);
    }
}
