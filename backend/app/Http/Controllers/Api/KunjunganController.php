<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisitForm;
use App\Models\FamilyForm;
use App\Models\FamilyMember;
use App\Models\KepuasanAnswer;
use App\Models\Relawan;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;
use App\Notifications\KunjunganVerified;
use App\Notifications\VisitSubmitted;
use App\Notifications\VisitUpdated;
use Exception;

class KunjunganController extends Controller
{
    /**
     * ============================
     * ROLE & ACCESS HELPERS (NEW)
     * ============================
     * Role yang valid sekarang:
     * - relawan
     * - kunjungan_koordinator
     * - apk_koordinator
     * - admin_paslon
     */

    private function isAdminPaslon($user): bool
    {
        return $user && (int)$user->role_id === 2;
    }

    private function isKunjunganKoordinator($user): bool
    {
        return $user && (int)$user->role_id === 4;
    }

    /**
     * Guard: relawan harus punya is_kunjungan=1 untuk akses fitur kunjungan
     * Double job (is_kunjungan=1 & is_apk=1) tetap boleh.
     */
    private function ensureRelawanCanKunjungan($user)
    {
        if (!$user) return response()->json(['success'=>false,'message'=>'Unauthorized'], 401);

        if ((int)$user->role_id !== 6) return null; // non-relawan skip

        $relawan = $user->relawan;
        if (!$relawan) {
            return response()->json([
                'success' => false,
                'message' => 'Akun relawan tidak valid (relawan record tidak ditemukan).'
            ], 403);
        }

        if ((int)($relawan->is_kunjungan ?? 0) !== 1) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk melakukan kunjungan.'
            ], 403);
        }

        return null;
    }

    /**
     * Guard: fitur kunjungan hanya boleh diakses oleh:
     * - admin_paslon
     * - kunjungan_koordinator
     * - relawan dengan is_kunjungan=1
     * Role lain (apk_koordinator) ditolak.
     */
    private function ensureCanAccessKunjunganFeature($user)
    {
        if (!$user) return response()->json(['success'=>false,'message'=>'Unauthorized'], 401);

        if ($this->isAdminPaslon($user) || $this->isKunjunganKoordinator($user)) return null;

        if ((int)$user->role_id === 6) {
            return $this->ensureRelawanCanKunjungan($user);
        }

        return response()->json([
            'success' => false,
            'message' => 'Anda tidak memiliki akses fitur kunjungan.'
        ], 403);
    }

    /**
     * CREATE KUNJUNGAN (STEP 1)
     * Alamat didapat dari reverse geocoding koordinat GPS
     */
    public function store(Request $request)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            // [NEW] akses fitur kunjungan hanya untuk relawan is_kunjungan / kunjungan_koordinator / admin_paslon
            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $rules = [
                'nama' => ['required', 'string', 'max:255', 'regex:/^[a-zA-Z\s\.\`\']+$/'],
                'nik' => [
                    'required',
                    'digits:16',
                    'unique:kunjungan_forms,nik',
                    function ($attribute, $value, $fail) {
                        $existsInFamily = \App\Models\FamilyMember::where('nik', $value)->exists();
                        if ($existsInFamily) {
                            $fail('NIK sudah terdaftar sebagai anggota keluarga di kunjungan lain.');
                        }
                    },
                ],
                'tanggal' => 'nullable|date|before_or_equal:' . Carbon::now()->subYears(17)->format('Y-m-d'),
                'pendidikan' => 'nullable|in:SD,SMP,SMA/SMK,D3,S1,S2+',
                'pekerjaan' => 'nullable|string|max:255',
                'penghasilan' => 'nullable|string|max:100',
                'foto_ktp' => 'nullable|file|max:5120',
                'alamat' => 'nullable|string|min:10',
                'latitude' => 'nullable|numeric|between:-90,90',
                'longitude' => 'nullable|numeric|between:-180,180',
                'offline_id' => 'nullable|string|unique:kunjungan_forms,offline_id',
            ];

            // If it's a full submission (not draft), make fields required
            if (!$request->has('is_draft')) {
                $rules['tanggal'] = 'required|date|before_or_equal:' . Carbon::now()->subYears(17)->format('Y-m-d');
                $rules['pendidikan'] = 'required|in:SD,SMP,SMA/SMK,D3,S1,S2+';
                $rules['pekerjaan'] = 'required|string|max:255';
                $rules['penghasilan'] = 'required|string|max:100';
                $rules['foto_ktp'] = 'required|file|max:5120';
                $rules['alamat'] = 'required|string|min:10';
            }

            $validator = Validator::make($request->all(), $rules, [
                'nik.unique' => 'NIK sudah terdaftar dalam sistem',
                'nik.digits' => 'NIK harus 16 digit',
                'nik.required' => 'NIK wajib diisi',
                'tanggal.before_or_equal' => 'Umur minimal harus 17 tahun',
                'alamat.min' => 'Alamat minimal 10 karakter',
                'foto_ktp.required' => 'Foto KTP wajib dilampirkan',
                'foto_ktp.image' => 'File harus berupa gambar',
                'foto_ktp.mimes' => 'Format foto harus JPG, JPEG, atau PNG',
                'foto_ktp.max' => 'Ukuran foto maksimal 5MB',
            ]);

            if ($validator->fails()) {
                Log::warning('Validation failed for store kunjungan', [
                    'errors' => $validator->errors()->toArray(),
                    'data' => $request->except(['foto_ktp'])
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Validasi gagal',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();
            try {
                $file = $request->file('foto_ktp');
                $fotoPath = null;

                if ($file && $file->isValid()) {
                    $ext = $file->getClientOriginalExtension();

                    $fileName = 'ktp_' . $request->nik . '_' . time() . '.' . $ext;
                    $fotoPath = 'ktp/' . $fileName;
                    $stored = Storage::disk('public')->put($fotoPath, file_get_contents($file->getRealPath()));

                    if (!$stored) {
                        throw new Exception('Gagal menyimpan foto KTP');
                    }
                }

                /** @var \App\Models\Relawan|null $relawan */
                $relawan = $user ? $user->relawan : null;

                $relawan_id = null;
                $task_id = null;
                $campaign_id = null;

                if ($relawan) {
                    $relawan_id = $relawan->id;

                    $activeTask = Task::where('relawan_id', $relawan_id)
                        ->where('status', '!=', 'completed')
                        ->latest()
                        ->first();

                    if ($activeTask) {
                        $task_id = $activeTask->id;
                        $campaign_id = $activeTask->campaign_id;
                    } else {
                        $campaignRelawan = \App\Models\CampaignRelawan::where('relawan_id', $relawan_id)->first();
                        if ($campaignRelawan) {
                            $campaign_id = $campaignRelawan->campaign_id;
                        }
                    }
                }

                $umur = $request->tanggal ? \Carbon\Carbon::parse($request->tanggal)->age : null;

                $kunjungan = VisitForm::create([
                    'task_id' => $task_id,
                    'relawan_id' => $relawan_id,

                    // [NEW] paslon_id mengikuti relawan yang melakukan kunjungan
                    'paslon_id' => $relawan ? ($relawan->paslon_id ?? null) : null,

                    'campaign_id' => $campaign_id,
                    'nama' => $request->nama,
                    'nik' => $request->nik,
                    'tanggal' => $request->tanggal ?? null,
                    'umur' => $umur ?? 0,
                    'pendidikan' => $request->pendidikan ?? '-',
                    'pekerjaan' => $request->pekerjaan ?? '-',
                    'penghasilan' => $request->penghasilan ?? '-',
                    'foto_ktp' => $fotoPath ?? 'pending.jpg',
                    'alamat' => $request->alamat ?? '-',
                    'latitude' => $request->latitude ?? 0,
                    'longitude' => $request->longitude ?? 0,
                    'offline_id' => $request->offline_id ?? null,
                    'status' => $request->has('is_draft') ? 'draft' : 'pending',
                    'status_verifikasi' => 'pending',
                    'created_by' => $user ? $user->id : null,
                ]);

                // Otomatis buat record FamilyForm
                $familyForm = FamilyForm::create([
                    'kunjungan_id' => $kunjungan->id,
                    'alamat_keluarga' => $request->alamat ?? '-',
                    'jumlah_anggota_memiliki_ktp' => 0
                ]);

                DB::commit();

                Log::info('Kunjungan created successfully', [
                    'id' => $kunjungan->id,
                    'nik' => $kunjungan->nik,
                    'user_id' => Auth::id(),
                    'gps' => ['lat' => $request->latitude, 'lon' => $request->longitude]
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Data kunjungan berhasil disimpan',
                    'data' => $kunjungan->load('familyForm')
                ], 201);
            } catch (Exception $e) {
                DB::rollBack();

                if (isset($fotoPath) && Storage::disk('public')->exists($fotoPath)) {
                    Storage::disk('public')->delete($fotoPath);
                }

                Log::error('DB_DEBUG_TRACE Create kunjungan failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'user_id' => Auth::id(),
                    'data' => $request->except('foto_ktp')
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Gagal menyimpan data kunjungan: ' . $e->getMessage(),
                    'error' => config('app.debug') ? $e->getMessage() : 'Terjadi kesalahan server'
                ], 500);
            }
        } catch (Exception $e) {
            Log::error('Store kunjungan outer catch', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan sistem',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * TAMBAH ANGGOTA KELUARGA (STEP 2)
     */
    public function tambahAnggota(Request $request, $kunjungan_id)
    {
        Log::info('tambahAnggota called', ['kunjungan_id' => $kunjungan_id, 'data' => $request->except('foto_ktp')]);
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $kunjungan = VisitForm::find($kunjungan_id);

            if (!$kunjungan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data kunjungan tidak ditemukan'
                ], 404);
            }

            if ($kunjungan->status === 'completed') {
                Log::info('Adding member to already completed visit', ['kunjungan_id' => $kunjungan_id]);
            }

            $validator = Validator::make($request->all(), [
                'nama' => ['required', 'string', 'max:255', 'regex:/^[a-zA-Z\s\.\`\']+$/'],
                'nik' => [
                    'required',
                    'digits:16',
                    function ($attribute, $value, $fail) {
                        if (DB::table('kunjungan_forms')->where('nik', $value)->exists()) {
                            $fail('NIK identik dengan kepala keluarga yang sudah terdaftar.');
                        }
                        if (DB::table('keluarga_members')->where('nik', $value)->exists()) {
                            $fail('NIK sudah terdaftar sebagai anggota keluarga lain.');
                        }
                    },
                ],
                'tanggal_lahir' => [
                    'required',
                    'date',
                ],
                'hubungan' => 'required|string|max:50',
                'pekerjaan' => 'nullable|string|max:255',
                'pendidikan' => 'required|string',
                'penghasilan' => 'required|string',
                'foto_ktp' => 'nullable|file|max:5120'
            ], [
                'nama.required' => 'Nama anggota keluarga wajib diisi',
                'nik.required' => 'NIK wajib diisi',
                'nik.digits' => 'NIK harus 16 digit',
                'tanggal_lahir.required' => 'Tanggal lahir wajib diisi',
                'tanggal_lahir.date' => 'Format tanggal lahir tidak valid',
                'hubungan.required' => 'Hubungan keluarga wajib dipilih',
                'pendidikan.required' => 'Pendidikan wajib diisi',
                'penghasilan.required' => 'Penghasilan wajib diisi',
                'foto_ktp.max' => 'Ukuran foto maksimal 5MB'
            ]);

            if ($validator->fails()) {
                Log::warning('Validation failed for tambahAnggota', [
                    'kunjungan_id' => $kunjungan_id,
                    'errors' => $validator->errors()->toArray()
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Validasi gagal',
                    'errors' => $validator->errors()
                ], 422);
            }

            $familyForm = FamilyForm::where('kunjungan_id', $kunjungan_id)->first();

            if (!$familyForm) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data keluarga tidak ditemukan'
                ], 404);
            }

            DB::beginTransaction();

            $fotoPath = 'pending.jpg';
            if ($request->hasFile('foto_ktp')) {
                $file = $request->file('foto_ktp');
                $ext = $file->getClientOriginalExtension();
                $fileName = 'ktp_anggota_' . time() . '_' . uniqid() . '.' . $ext;
                $fotoPath = 'ktp/' . $fileName;
                Storage::disk('public')->put($fotoPath, file_get_contents($file->getRealPath()));
            }

            $anggota = $familyForm->members()->create([
                'nama' => $request->nama,
                'nik' => $request->nik,
                'tanggal_lahir' => $request->tanggal_lahir,
                'umur' => \Carbon\Carbon::parse($request->tanggal_lahir)->age,
                'hubungan' => $request->hubungan,
                'pekerjaan' => $request->pekerjaan,
                'pendidikan' => $request->pendidikan,
                'penghasilan' => $request->penghasilan,
                'foto_ktp' => $fotoPath
            ]);

            DB::commit();

            Log::info('Anggota keluarga added', [
                'kunjungan_id' => $kunjungan_id,
                'anggota_id' => $anggota->id,
                'nama' => $anggota->nama
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Anggota keluarga berhasil ditambahkan',
                'data' => $anggota
            ], 201);
        } catch (Exception $e) {
            DB::rollBack();

            Log::error('Add anggota failed', [
                'kunjungan_id' => $kunjungan_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal menambahkan anggota keluarga',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * SELESAIKAN KUNJUNGAN (STEP 3)
     */
    public function selesaikanKunjungan(Request $request, $kunjungan_id)
    {
        DB::beginTransaction();
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                DB::rollBack();
                return $resp;
            }

            $kunjungan = VisitForm::with(['familyForm.members', 'relawan.koordinator.user', 'paslon'])->find($kunjungan_id);

            if (!$kunjungan) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Data kunjungan tidak ditemukan'
                ], 404);
            }

            $updateData = [
                'status' => 'pending',
                'status_verifikasi' => 'pending',
                'completed_by' => Auth::id(),
            ];

            if (!$kunjungan->completed_at) {
                $updateData['completed_at'] = now();
            }

            if ($request->has('score')) {
                $updateData['score'] = $request->score;
            }

            $kunjungan->update($updateData);

            $request->validate([
                'harapan' => 'nullable|string',
            ]);

            $payload = $request->only([
                'tau_paslon',
                'tau_informasi',
                'tau_visi_misi',
                'tau_program_kerja',
                'tau_rekam_jejak',
                'pernah_dikunjungi',
                'percaya',
                'harapan',
                'pertimbangan',
                'ingin_memilih'
            ]);

            // [NEW] paslon_id ikut disimpan agar survey dinamis sesuai paslon relawan
            $payload['paslon_id'] = $kunjungan->paslon_id
                ?? ($kunjungan->relawan ? ($kunjungan->relawan->paslon_id ?? null) : null);

            $kunjungan->kepuasan()->updateOrCreate(
                ['kunjungan_id' => $kunjungan->id],
                $payload
            );

            // Trigger Notification to Coordinator
            try {
                if ($kunjungan->relawan && $kunjungan->relawan->koordinator && $kunjungan->relawan->koordinator->user) {
                    $coordinatorUser = $kunjungan->relawan->koordinator->user;

                    if ($kunjungan->komentar_verifikasi) {
                        $coordinatorUser->notify(new \App\Notifications\VisitUpdated($kunjungan, $user));
                    } else {
                        $coordinatorUser->notify(new VisitSubmitted($kunjungan, $kunjungan->relawan));
                    }
                }
            } catch (\Exception $e) {
                Log::error('Failed to send VisitSubmitted notification', ['error' => $e->getMessage()]);
            }

            DB::commit();

            Log::info('Kunjungan completed successfully', [
                'id' => $kunjungan_id,
                'score' => $request->score,
                'jumlah_anggota' => $kunjungan->familyForm ? $kunjungan->familyForm->members()->count() : 0,
                'completed_by' => Auth::id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Kunjungan berhasil diselesaikan',
                'data' => $kunjungan->fresh(['familyForm.members'])
            ]);
        } catch (Exception $e) {
            DB::rollBack();

            Log::error('Complete kunjungan failed', [
                'id' => $kunjungan_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal menyelesaikan kunjungan',
                'error' => config('app.debug') ? $e->getMessage() : 'Terjadi kesalahan server'
            ], 500);
        }
    }

    /**
     * GET DETAIL KUNJUNGAN (Opsional - untuk review sebelum submit)
     */
    public function show($kunjungan_id)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $kunjungan = VisitForm::with([
                'familyForm.members',
                'relawan',
                'campaign',
                'task',
                'kepuasan',
                'paslon',
            ])->find($kunjungan_id);

            if (!$kunjungan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data kunjungan tidak ditemukan'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $kunjungan
            ]);
        } catch (Exception $e) {
            Log::error('Get kunjungan detail failed', [
                'id' => $kunjungan_id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil data kunjungan',
                'error' => config('app.debug') ? $e->getMessage() : 'Terjadi kesalahan server'
            ], 500);
        }
    }

    /**
     * LIST KUNJUNGAN (Opsional)
     */
    public function index(Request $request)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $query = VisitForm::with([
                'relawan:id,nama',
                'familyForm' => function ($q) {
                    $q->withCount('members')->with('members');
                }
            ]);

            // Strict Role-Based Scoping
            if ($user && $user->role === 'relawan') {
                if ($user->relawan) {
                    $query->where(function ($q) use ($user) {
                        $q->where('relawan_id', $user->relawan->id)
                          ->where('created_by', $user->id);
                    });
                } else {
                    $query->where('created_by', $user->id);
                }
            } elseif ($user && $user->role === 'kunjungan_koordinator') {
                if ($request->has('relawan_id')) {
                    $relawanId = $request->relawan_id;
                    $targetRelawan = \App\Models\Relawan::find($relawanId);

                    if ($targetRelawan && $user->koordinator && $targetRelawan->koordinator_id === $user->koordinator->id) {
                        $query->where('relawan_id', $relawanId);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                } else {
                    $koordinator = $user->koordinator;
                    if ($koordinator) {
                        $query->where(function ($subQ) use ($koordinator) {
                            $subQ->whereHas('relawan', function ($rq) use ($koordinator) {
                                $rq->where('koordinator_id', $koordinator->id);
                            })
                            ->orWhereIn('created_by', function ($q) use ($koordinator) {
                                $q->select('users.id')
                                  ->from('users')
                                  ->join('relawans', 'relawans.user_id', '=', 'users.id')
                                  ->where('relawans.koordinator_id', $koordinator->id);
                            });
                        });
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                }
            } elseif ($user && $user->role === 'admin_paslon') {
                if ($request->has('relawan_id')) {
                    $query->where('relawan_id', $request->relawan_id);
                }
            } else {
                $query->whereRaw('1 = 0');
            }

            if ($request->has('status')) {
                if ($request->status === 'draft') {
                    $query->where('status', 'draft');
                } elseif (in_array($request->status, ['pending', 'accepted', 'rejected'])) {
                    $query->where('status_verifikasi', $request->status);
                }
            }

            if ($request->has('status_verifikasi')) {
                $query->where('status_verifikasi', $request->status_verifikasi);
            }

            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('nama', 'like', "%{$search}%")
                      ->orWhere('nik', 'like', "%{$search}%");
                });
            }

            $kunjungan = $query->orderBy('created_at', 'desc')
                ->paginate($request->per_page ?? 15);

            // Stats
            if ($user && $user->role === 'relawan' && $user->relawan) {
                $baseQuery = VisitForm::where('relawan_id', $user->relawan->id);
                $total = (clone $baseQuery)->count();
                $pending = (clone $baseQuery)->where('status_verifikasi', 'pending')->count();
                $accepted = (clone $baseQuery)->where('status_verifikasi', 'accepted')->count();
                $rejected = (clone $baseQuery)->where('status_verifikasi', 'rejected')->count();
            } elseif ($user && ($user->role === 'kunjungan_koordinator' || $user->role === 'admin_paslon')) {
                $total = VisitForm::count();
                $pending = VisitForm::where('status_verifikasi', 'pending')->count();
                $accepted = VisitForm::where('status_verifikasi', 'accepted')->count();
                $rejected = VisitForm::where('status_verifikasi', 'rejected')->count();
            } else {
                $total = $pending = $accepted = $rejected = 0;
            }

            return response()->json([
                'success' => true,
                'data' => $kunjungan,
                'stats' => [
                    'total' => $total,
                    'pending' => $pending,
                    'accepted' => $accepted,
                    'rejected' => $rejected,
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $kunjungan = VisitForm::find($id);

            if (!$kunjungan) {
                return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
            }

            if ($kunjungan->status_verifikasi === 'rejected') {
                $kunjungan->status_verifikasi = 'pending';
                $kunjungan->verified_by = null;
                $kunjungan->verified_at = null;
            }

            $validator = Validator::make($request->all(), [
                'nama' => 'required|string|max:255',
                'nik' => [
                    'required',
                    'digits:16',
                    function ($attribute, $value, $fail) use ($id) {
                        if (DB::table('kunjungan_forms')->where('nik', $value)->where('id', '!=', $id)->exists()) {
                            $fail('NIK sudah terdaftar sebagai kepala keluarga lain.');
                        }
                        if (DB::table('keluarga_members')->where('nik', $value)->exists()) {
                            $fail('NIK sudah terdaftar sebagai anggota keluarga.');
                        }
                    },
                ],
                'tanggal' => [
                    'required',
                    'date',
                    'before_or_equal:' . Carbon::now()->subYears(17)->format('Y-m-d'),
                ],
                'pendidikan' => 'required|in:SD,SMP,SMA/SMK,D3,S1,S2+',
                'pekerjaan' => 'required|string|max:255',
                'penghasilan' => 'required|string|max:255',
                'alamat' => 'required|string',
                'latitude' => 'nullable',
                'longitude' => 'nullable',
                'foto_ktp' => 'nullable|file|max:5120',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $data = $request->only(['nama', 'nik', 'tanggal', 'pendidikan', 'pekerjaan', 'penghasilan', 'alamat', 'latitude', 'longitude']);
            $data['umur'] = \Carbon\Carbon::parse($request->tanggal)->age;

            if ($request->hasFile('foto_ktp')) {
                if ($kunjungan->foto_ktp) {
                    Storage::disk('public')->delete($kunjungan->foto_ktp);
                }
                $file = $request->file('foto_ktp');
                $ext = $file->getClientOriginalExtension();
                $fileName = 'ktp_' . $request->nik . '_' . time() . '.' . $ext;
                $path = 'ktp/' . $fileName;
                Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));
                $data['foto_ktp'] = $path;
            }

            $kunjungan->update($data);

            DB::table('notifications')
                ->where('data', 'LIKE', '%"visit_id":' . $id . '%')
                ->orWhere('data', 'LIKE', '%"visit_id": "' . $id . '"%')
                ->orWhere('data', 'LIKE', '%"visit_id":"' . $id . '"%')
                ->orWhere('data', 'LIKE', '%"kunjungan_id":' . $id . '%')
                ->delete();

            try {
                $targetUser = null;

                if ($user && $user->role === 'relawan' && $kunjungan->relawan && $kunjungan->relawan->koordinator && $kunjungan->relawan->koordinator->user) {
                    $targetUser = $kunjungan->relawan->koordinator->user;
                } elseif ($user && $user->role === 'kunjungan_koordinator' && $kunjungan->relawan && $kunjungan->relawan->user) {
                    $targetUser = $kunjungan->relawan->user;
                }

                if ($targetUser && $user && $targetUser->id !== $user->id) {
                    $targetUser->notify(new VisitUpdated($kunjungan, $user));
                }
            } catch (\Exception $e) {
                Log::error('Failed to send VisitUpdated notification', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Data kepala keluarga berhasil diperbarui',
                'data' => $kunjungan
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $kunjungan = VisitForm::find($id);

            if (!$kunjungan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data tidak ditemukan'
                ], 404);
            }

            if ($kunjungan->foto_ktp) {
                Storage::disk('public')->delete($kunjungan->foto_ktp);
            }

            if ($kunjungan->familyForm) {
                foreach ($kunjungan->familyForm->members as $member) {
                    if ($member->foto_ktp) {
                        Storage::disk('public')->delete($member->foto_ktp);
                    }
                }
                $kunjungan->familyForm->delete();
            }

            try {
                $visitId = $kunjungan->id;
                $deletedCount = DB::table('notifications')
                    ->where('data', 'LIKE', '%"visit_id":' . $visitId . '%')
                    ->orWhere('data', 'LIKE', '%"visit_id": "' . $visitId . '"%')
                    ->orWhere('data', 'LIKE', '%"visit_id":"' . $visitId . '"%')
                    ->orWhere('data', 'LIKE', '%"kunjungan_id":' . $visitId . '%')
                    ->orWhere('data', 'LIKE', '%"kunjungan_id": "' . $visitId . '"%')
                    ->orWhere('data', 'LIKE', '%"kunjungan_id":"' . $visitId . '"%')
                    ->delete();

                Log::info("Deleted {$deletedCount} notifications for visit {$visitId} when deleting visit.");
            } catch (\Exception $e) {
                Log::error('Gagal menghapus notifikasi terkait', ['error' => $e->getMessage()]);
            }

            try {
                $userRole = $user ? $user->role : null;
                Log::info("Deleting visit {$kunjungan->id}. User role: {$userRole}");

                if ($userRole === 'relawan') {
                    if ($kunjungan->relawan && $kunjungan->relawan->koordinator && $kunjungan->relawan->koordinator->user) {
                        $coordUser = $kunjungan->relawan->koordinator->user;
                        $coordUser->notify(new \App\Notifications\VisitDeleted(
                            $kunjungan->nama,
                            $kunjungan->relawan->nama,
                            $userRole
                        ));
                        Log::info("Sent VisitDeleted notification to Coordinator ID: {$coordUser->id}");
                    } else {
                        Log::warning("Cannot send VisitDeleted: Missing relationship (Relawan->Koordinator->User). Relawan ID: {$kunjungan->relawan_id}");
                    }
                }
            } catch (\Exception $e) {
                Log::error('Gagal mengirim notifikasi VisitDeleted', ['error' => $e->getMessage()]);
            }

            if ($kunjungan->kepuasan) {
                $kunjungan->kepuasan->delete();
            }

            $kunjungan->delete();

            return response()->json([
                'success' => true,
                'message' => 'Data kunjungan berhasil dihapus'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function updateAnggota(Request $request, $id)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $anggota = FamilyMember::find($id);
            if (!$anggota) {
                return response()->json(['success' => false, 'message' => 'Anggota tidak ditemukan'], 404);
            }

            $keluargaForm = $anggota->keluargaForm;
            $kunjunganParent = $keluargaForm ? $keluargaForm->kunjungan : null;

            if ($kunjunganParent && $kunjunganParent->status_verifikasi === 'rejected') {
                $kunjunganParent->status_verifikasi = 'pending';
                $kunjunganParent->verified_by = null;
                $kunjunganParent->verified_at = null;
                $kunjunganParent->save();
            }

            $validator = Validator::make($request->all(), [
                'nama' => 'required|string|max:255',
                'nik' => [
                    'required',
                    'digits:16',
                    function ($attribute, $value, $fail) use ($id) {
                        if (DB::table('kunjungan_forms')->where('nik', $value)->exists()) {
                            $fail('NIK identik dengan kepala keluarga.');
                        }
                        if (DB::table('keluarga_members')->where('nik', $value)->where('id', '!=', $id)->exists()) {
                            $fail('NIK sudah terdaftar sebagai anggota keluarga lain.');
                        }
                    },
                ],
                'tanggal_lahir' => [
                    'required',
                    'date',
                ],
                'hubungan' => 'required|string|max:50',
                'pekerjaan' => 'nullable|string|max:255',
                'pendidikan' => 'required|string',
                'penghasilan' => 'required|string',
                'foto_ktp' => 'nullable|file|max:5120'
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $data = $request->except(['foto_ktp']);
            $data['umur'] = \Carbon\Carbon::parse($request->tanggal_lahir)->age;

            if ($request->hasFile('foto_ktp')) {
                if ($anggota->foto_ktp) {
                    Storage::disk('public')->delete($anggota->foto_ktp);
                }
                $file = $request->file('foto_ktp');
                $ext = $file->getClientOriginalExtension();
                $path = 'kunjungan/anggota/ktp_anggota_' . time() . '.' . $ext;
                Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));
                $data['foto_ktp'] = $path;
            }

            $anggota->update($data);

            try {
                if ($kunjunganParent) {
                    $targetUser = null;

                    if ($user && $user->role === 'relawan' && $kunjunganParent->relawan && $kunjunganParent->relawan->koordinator && $kunjunganParent->relawan->koordinator->user) {
                        $targetUser = $kunjunganParent->relawan->koordinator->user;
                    } elseif ($user && $user->role === 'kunjungan_koordinator' && $kunjunganParent->relawan && $kunjunganParent->relawan->user) {
                        $targetUser = $kunjunganParent->relawan->user;
                    }

                    if ($targetUser && $user && $targetUser->id !== $user->id) {
                        $targetUser->notify(new VisitUpdated($kunjunganParent, $user));
                    }
                }
            } catch (\Exception $e) {
                Log::error('Failed to send VisitUpdated notification (Anggota)', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Data anggota berhasil diperbarui',
                'data' => $anggota
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function hapusAnggota($id)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
                return $resp;
            }

            $anggota = FamilyMember::find($id);
            if (!$anggota) {
                return response()->json(['success' => false, 'message' => 'Anggota tidak ditemukan'], 404);
            }

            if ($anggota->foto_ktp) {
                Storage::disk('public')->delete($anggota->foto_ktp);
            }

            $anggota->delete();

            return response()->json([
                'success' => true,
                'message' => 'Anggota berhasil dihapus'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * VERIFIKASI KUNJUNGAN (KUNJUNGAN_KOORDINATOR ONLY)
     * Setuju atau tolak dengan komentar revisi
     */
    public function verifikasi(Request $request, $id)
    {
        try {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();

            if (!$this->isKunjunganKoordinator($user) || !$user->koordinator) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            }

            $kunjungan = VisitForm::with(['relawan'])->findOrFail($id);

            $koordinator = $user->koordinator;
            if ($koordinator && $kunjungan->relawan) {
                if ($kunjungan->relawan->koordinator_id !== $koordinator->id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Anda tidak memiliki akses untuk memverifikasi kunjungan ini'
                    ], 403);
                }
            }

            $validator = Validator::make($request->all(), [
                'status' => 'required|in:accepted,rejected,needs_revision',
                'komentar' => 'nullable|string|max:500',
            ], [
                'status.required' => 'Status verifikasi wajib diisi',
                'status.in' => 'Status harus accepted, rejected, atau needs_revision',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $kunjungan->status_verifikasi = $request->status;
            $kunjungan->komentar_verifikasi = $request->komentar;
            $kunjungan->verified_by = $koordinator ? $koordinator->id : null;
            $kunjungan->verified_at = now();
            $kunjungan->save();

            if ($kunjungan->relawan && $kunjungan->relawan->user) {
                if ($request->status === 'accepted') {
                    $kunjungan->relawan->user->notify(new \App\Notifications\KunjunganVerified($kunjungan));
                } elseif ($request->status === 'rejected') {
                    $pesan = 'Kunjungan Anda ditolak: ' . ($request->komentar ?: 'Silakan revisi dan submit ulang');
                    $kunjungan->relawan->user->notify(new \App\Notifications\KunjunganRejected($kunjungan, $pesan));
                } elseif ($request->status === 'needs_revision') {
                    $kunjungan->relawan->user->notify(new \App\Notifications\KunjunganNeedsRevision($kunjungan, $request->komentar));
                }
            }

            return response()->json([
                'success' => true,
                'message' => $request->status === 'accepted'
                    ? 'Kunjungan berhasil diverifikasi'
                    : ($request->status === 'needs_revision'
                        ? 'Kunjungan ditandai perlu revisi'
                        : 'Kunjungan ditolak dan perlu revisi'),
                'data' => $kunjungan
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * GET NEXT BATCH for verification (round-robin)
     */
    public function getNextBatch()
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        if (!$user || $user->role !== 'kunjungan_koordinator' || !$user->koordinator) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $koordinatorId = $user->koordinator->id;
        $cacheKey = "verifikasi_rr_{$koordinatorId}";
        $lastRelawanId = Cache::get($cacheKey, 0);

        $nextRelawan = Relawan::where('koordinator_id', $koordinatorId)
            ->where('id', '>', $lastRelawanId)
            ->whereHas('visitForms', function ($q) {
                $q->where('status_verifikasi', 'pending');
            })
            ->with([
                'visitForms' => function ($q) {
                    $q->where('status_verifikasi', 'pending')
                        ->orderBy('created_at')
                        ->limit(5);
                }
            ])
            ->orderBy('id')
            ->first();

        if (!$nextRelawan) {
            $nextRelawan = Relawan::where('koordinator_id', $koordinatorId)
                ->whereHas('visitForms', function ($q) {
                    $q->where('status_verifikasi', 'pending');
                })
                ->with([
                    'visitForms' => function ($q) {
                        $q->where('status_verifikasi', 'pending')
                            ->orderBy('created_at')
                            ->limit(5);
                    }
                ])
                ->orderBy('id')
                ->first();
        }

        if (!$nextRelawan) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada kunjungan pending yang perlu diverifikasi'
            ]);
        }

        Cache::put($cacheKey, $nextRelawan->id, now()->addDays(1));

        $totalPending = $nextRelawan->visitForms()->where('status_verifikasi', 'pending')->count();
        $batchCount = min(5, $totalPending);

        try {
            $user->notify(new KunjunganVerified(
                $nextRelawan,
                $batchCount
            ));
        } catch (\Exception $e) {
            Log::error('Failed to send VerificationBatchReady notification', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'relawan_id' => $nextRelawan->id,
                'relawan_nama' => $nextRelawan->nama,
                'count' => $batchCount,
                'redirect_url' => "/kunjungan?relawan_id={$nextRelawan->id}&status=pending&batch=true&limit=5"
            ]
        ]);
    }

    /**
     * CHECK NIK AVAILABILITY (Relawan)
     * Limit return data to protect privacy, only validation status.
     */
    public function checkNik(Request $request)
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        if ($resp = $this->ensureCanAccessKunjunganFeature($user)) {
            return $resp;
        }

        $request->validate([
            'nik' => 'required|digits:16'
        ]);

        $nik = $request->nik;

        $existsAsHead = DB::table('kunjungan_forms')->where('nik', $nik)->exists();
        if ($existsAsHead) {
            return response()->json([
                'available' => false,
                'message' => 'NIK sudah terdaftar sebagai Kepala Keluarga.'
            ]);
        }

        $existsAsMember = DB::table('keluarga_members')->where('nik', $nik)->exists();
        if ($existsAsMember) {
            return response()->json([
                'available' => false,
                'message' => 'NIK sudah terdaftar sebagai Anggota Keluarga.'
            ]);
        }

        return response()->json([
            'available' => true,
            'message' => 'NIK tersedia.'
        ]);
    }
}
