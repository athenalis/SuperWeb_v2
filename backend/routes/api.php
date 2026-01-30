<?php

use App\Models\Party;
use App\Models\Paslon;
use Illuminate\Http\Request;
use App\Models\ContentStatus;
use App\Exports\RelawanTemplate;
use App\Exports\KoordinatorTemplate;
use App\Exports\KoordinatorApkTemplate;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\Analisis;
use App\Http\Controllers\Api\DptController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrmasController;
use App\Http\Controllers\Api\SuaraController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\PaslonController;
use App\Http\Controllers\Api\HistoryController;
use App\Http\Controllers\Api\RelawanController;
use App\Http\Controllers\Api\WilayahController;
use App\Http\Controllers\Api\AdminApkController;
use App\Http\Controllers\Api\MapVisitController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\KunjunganController;
use App\Http\Controllers\Api\PetaSuaraController;
use App\Http\Controllers\Api\EngagementController;
use App\Http\Controllers\Api\InfluencerController;
use App\Http\Controllers\Api\PetaPartaiController;
use App\Http\Controllers\Api\AdminPaslonController;
use App\Http\Controllers\Api\ContentPlanController;
use App\Http\Controllers\Api\ContentTypeController;
use App\Http\Controllers\Api\CoordinatorController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\CoordinatorApkController;
use App\Http\Controllers\Api\ContentPlatformController;
use App\Http\Controllers\Api\CourierApkController;

// AUTH
Route::post('/login', [AuthController::class, 'login'])->name('login');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', fn(Request $request) => $request->user());
    Route::post('/logout', [AuthController::class, 'logout']);
});

/*
|--------------------------------------------------------------------------
| AUTHENTICATED - PUBLIC RESOURCES
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // activity log
    Route::get('/activity-logs', [HistoryController::class, 'index']);

    // Ormas
    Route::get('/ormas', [OrmasController::class, 'index']);

    // Wilayah user
    Route::get('/me/wilayah', [AuthController::class, 'wilayah']);

    // Wilayah master
    Route::prefix('wilayah')->group(function () {
        Route::get('/', [WilayahController::class, 'index']);
        Route::get('cities/{province}', [WilayahController::class, 'cities']);
        Route::get('districts/{city}', [WilayahController::class, 'districts']);
        Route::get('villages/{district}', [WilayahController::class, 'villages']);
        Route::get('pekerjaan', [WilayahController::class, 'pekerjaan']);
    });

    // Template download
    Route::get('/koordinator/template', fn() => Excel::download(new KoordinatorTemplate, 'template_koordinator.xlsx'));
    Route::get('/relawan/template', fn() => Excel::download(new RelawanTemplate, 'template_relawan.xlsx'));

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
    });
});

//ROLE: superadmin & admin_paslon
Route::middleware(['auth:sanctum', 'role:admin_paslon|superadmin'])->group(function () {

    // Suara
    Route::prefix('suara')->group(function () {
        Route::get('/paslon', [SuaraController::class, 'paslonCard']);
        Route::get('/diagram-paslon', [SuaraController::class, 'diagramPaslon']);
        Route::get('/diagram-partai', [SuaraController::class, 'diagramPartai']);
    });

    // Peta
    Route::prefix('peta')->group(function () {

        Route::prefix('paslon')->group(function () {
            Route::get('/kota', [PetaSuaraController::class, 'perKota']);
            Route::get('/kecamatan', [PetaSuaraController::class, 'perKecamatan']);
            Route::get('/kelurahan', [PetaSuaraController::class, 'perKelurahan']);
            Route::get('/', [PetaSuaraController::class, 'perKelurahan']); // backward compatibility
        });

        Route::prefix('dpt')->group(function () {
            Route::get('/kota', [DptController::class, 'dptCity']);
            Route::get('/kecamatan', [DptController::class, 'dptDistrict']);
            Route::get('/kelurahan', [DptController::class, 'dptVillage']);
        });

        Route::prefix('partai')->group(function () {
            Route::get('/kota', [PetaPartaiController::class, 'perKota']);
            Route::get('/kecamatan', [PetaPartaiController::class, 'perKecamatan']);
        });

        Route::get('/visit', [MapVisitController::class, 'mapData']);
    });
});

// ROLE: superadmin
Route::middleware(['auth:sanctum', 'role:superadmin'])->group(function () {

    Route::prefix('paslon')->group(function () {
        Route::post('/', [PaslonController::class, 'store']);
        Route::get('/', [PaslonController::class, 'index']);
        Route::get('/{id}', [PaslonController::class, 'show']);
    });

    // Admin Paslon
    Route::prefix('admin-paslon')->group(function () {
        Route::post('/', [AdminPaslonController::class, 'store']);
        Route::get('/', [AdminPaslonController::class, 'index']);
        Route::get('/{id}', [AdminPaslonController::class, 'show']);
    });

    Route::get('/paslons', fn() => Paslon::select('id', 'cagub', 'cawagub', 'nomor_urut')->get());
    Route::get('/parties', fn() => Party::select('party_code', 'party')->get());
});

/*
|--------------------------------------------------------------------------
| ROLE: admin_paslon
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin_paslon'])->group(function () {

    // Admin APK
    Route::prefix('admin-apk')->group(function () {
        Route::post('/', [AdminApkController::class, 'store']);
        Route::get('/', [AdminApkController::class, 'index']);
        Route::get('/{id}', [AdminApkController::class, 'show']);
        Route::put('/{id}', [AdminApkController::class, 'update']);
    });

    // Koordinator
    Route::prefix('koordinator')->name('koordinator.')->group(function () {
        Route::post('/export', [CoordinatorController::class, 'exportAllKunjungan']);
        Route::get('/', [CoordinatorController::class, 'index']);
        Route::get('/{id}', [CoordinatorController::class, 'show']);
        Route::post('/', [CoordinatorController::class, 'store']);
        Route::put('/{id}', [CoordinatorController::class, 'update']);
        Route::delete('/{id}', [CoordinatorController::class, 'destroy']);
        Route::get('/{id}/history', [CoordinatorController::class, 'history']);
        Route::post('/import', [CoordinatorController::class, 'import']);
        Route::post('/check-nik', [CoordinatorController::class, 'checkNik']);
        Route::post('/restore', [CoordinatorController::class, 'restoreByNik']);
        Route::post('/kunjungan/export', [CoordinatorController::class, 'export']);
        Route::post('/apk/export', [CoordinatorApkController::class, 'export']);
    });

    // Social media (content)
    Route::prefix('content-plans')->group(function () {
        Route::get('/', [ContentPlanController::class, 'index']);
        Route::get('/summary', [ContentPlanController::class, 'contentSummary']);
        Route::get('/{id}', [ContentPlanController::class, 'show']);
        Route::post('/', [ContentPlanController::class, 'store']);
        Route::put('/{id}', [ContentPlanController::class, 'update']);
        // Route::post('/{id}/post', [ContentPlanController::class, 'postContent']);
        Route::get('/{id}/analytics', [EngagementController::class, 'analyticContent']);
        Route::post('/{id}/analytics/record', [EngagementController::class, 'store']);
        Route::put('/{id}/analytics/record/{engagementId}', [EngagementController::class, 'update']);
    });

    // Dashboard
    Route::prefix('dashboard')->group(function () {
        Route::get('/', [DashboardController::class, 'index']);
        Route::get('/progress-bar', [DashboardController::class, 'progressBar']);
        Route::get('/stacked-bar', [DashboardController::class, 'stackedBar']);
        Route::get('/visit-summary', [DashboardController::class, 'visitSummary']);
    });

    // Influencers
    Route::prefix('influencers')->group(function () {
        Route::get('/', [InfluencerController::class, 'index']);
        Route::post('/', [InfluencerController::class, 'store']);
        Route::put('/{id}', [InfluencerController::class, 'update']);
        Route::get('/all', [InfluencerController::class, 'all']);
    });

    // Analisis
    Route::prefix('persebaran')->group(function () {
        Route::get('/straight-ticket/district', [Analisis::class, 'straightTicketByDistrict']);
    });

    // Content statuses
    Route::get('/content-statuses', fn() => ContentStatus::select('id', 'label')->get());

    // Budget
    Route::get('/budget', [BudgetController::class, 'index']);

    // Platform content
    Route::get('/platforms', [ContentPlatformController::class, 'index']);

    // Content type
    Route::get('/content-types', [ContentTypeController::class, 'index']);
});

// ROLE: admin_paslon | admin_apk | apk_koordinator (Kurir APK read)
Route::middleware(['auth:sanctum', 'role:admin_paslon|admin_apk|apk_koordinator'])->group(function () {
    Route::prefix('apk-kurir')->group(function () {
        Route::get('/', [CourierApkController::class, 'index']);
        Route::get('/{id}', [CourierApkController::class, 'show']);
    });
});

// ROLE: admin_apk | admin_paslon (Koordinator APK)
Route::middleware(['auth:sanctum', 'role:admin_apk|admin_paslon'])->group(function () {

    Route::prefix('koordinator-apk')->group(function () {
        Route::post('/', [CoordinatorApkController::class, 'store']);
        Route::get('/', [CoordinatorApkController::class, 'index']);
        Route::get('/{id}', [CoordinatorApkController::class, 'show']);
        Route::put('/{id}', [CoordinatorApkController::class, 'update']);
        Route::delete('/{id}', [CoordinatorApkController::class, 'destroy']);
        Route::post('/import', [CoordinatorApkController::class, 'import']);
        Route::post('/check-nik', [CoordinatorApkController::class, 'checkNik']);
        Route::post('/restore-by-nik', [CoordinatorApkController::class, 'restoreByNik']);
        Route::post('/apk/export', [CoordinatorApkController::class, 'export']);
        // Route::get('/template', fn() => Excel::download(new KoordinatorApkTemplate, 'template_koordinator_apk.xlsx'));
    });

    Route::prefix('apk-kurir')->group(function () {
        Route::post('/', [CourierApkController::class, 'store']);
        Route::put('/{id}', [CourierApkController::class, 'update']);
        Route::delete('/{id}', [CourierApkController::class, 'destroy']);
    });
});

// ROLE: kunjungan_koordinator | apk_koordinator
Route::middleware(['auth:sanctum', 'role:kunjungan_koordinator|apk_koordinator'])->group(function () {
    Route::prefix('relawan')->group(function () {

        Route::post('/import', [RelawanController::class, 'import']);

        // NOTE: sebelumnya ada 2x Route::post('/') (index & store) => bentrok.
        // Tetap path "/relawan", cuma index dibuat bisa POST/GET agar tidak hilang fungsi lama.
        Route::get('/', [RelawanController::class, 'index']);
        Route::post('/', [RelawanController::class, 'store']);
        Route::put('/{id}', [RelawanController::class, 'update']);
        Route::delete('/{id}', [RelawanController::class, 'destroy']);

        Route::post('/check-nik', [RelawanController::class, 'checkNik']);
        Route::post('/restore', [RelawanController::class, 'restoreByNik']);

        Route::post('/export-kunjungan', [RelawanController::class, 'exportKunjungan']);
        Route::post('/export-apk', [RelawanController::class, 'exportApk']);

        // Import relawan kunjungan (ONLY kunjungan_koordinator)
        Route::post('/import/kunjungan', [RelawanController::class, 'importKunjungan']);

        // Import relawan apk (ONLY apk_koordinator)
        Route::post('/import/apk', [RelawanController::class, 'importApk']);
    });
});

/*
|--------------------------------------------------------------------------
| ROLE: relawan
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:relawan'])->group(function () {
    Route::prefix('relawan/kunjungan')->group(function () {

        Route::get('/', [KunjunganController::class, 'index']);
        Route::get('/{id}', [KunjunganController::class, 'show']);

        Route::post('/', [KunjunganController::class, 'store']);
        Route::put('/{id}', [KunjunganController::class, 'update']);
        Route::delete('/{id}', [KunjunganController::class, 'destroy']);

        Route::post('/{kunjungan_id}/anggota', [KunjunganController::class, 'tambahAnggota']);
        Route::put('/anggota/{anggota_id}', [KunjunganController::class, 'updateAnggota']);
        Route::delete('/anggota/{anggota_id}', [KunjunganController::class, 'hapusAnggota']);

        Route::post('/{kunjungan_id}/selesai', [KunjunganController::class, 'selesaikanKunjungan']);
        Route::post('/check-nik', [KunjunganController::class, 'checkNik']);

        Route::get('/summary-kunjungan', [KunjunganController::class, 'index']);
    });
});


//     // // kunjungan - relawan and koor
//     // Route::middleware(['auth:sanctum', 'role:relawan|koordinator'])->prefix('kunjungan')->group(function () {
//     //     Route::get('/', [KunjunganController::class, 'index']);
//     //     Route::get('/{id}', [KunjunganController::class, 'show']);
//     // });

//     // // kunjungan - relawan only
//     // Route::middleware(['auth:sanctum', 'role:relawan'])->prefix('kunjungan')->group(function () {
//     //     Route::post('/', [KunjunganController::class, 'store']);
//     //     Route::put('/{id}', [KunjunganController::class, 'update']);
//     //     Route::delete('/{id}', [KunjunganController::class, 'destroy']);
//     //     Route::post('/{kunjungan_id}/anggota', [KunjunganController::class, 'tambahAnggota']);
//     //     Route::put('/anggota/{anggota_id}', [KunjunganController::class, 'updateAnggota']);
//     //     Route::delete('/anggota/{anggota_id}', [KunjunganController::class, 'hapusAnggota']);
//     //     Route::post('/{kunjungan_id}/selesai', [KunjunganController::class, 'selesaikanKunjungan']);
//     //     Route::post('/ocr-ktp', [KunjunganController::class, 'ocrKtp']);
//     //     Route::get('/summary-kunjungan', [KunjunganController::class, 'index']);
//     //     Route::post('/check-nik', [KunjunganController::class, 'checkNik']);
//     // });

//     // // kunjungan - koor only
//     // Route::middleware(['auth:sanctum', 'role:koordinator'])->prefix('kunjungan')->group(function () {
//     //     Route::get('/batch/next', [KunjunganController::class, 'getNextBatch']);
//     //     Route::post('/{id}/verifikasi', [KunjunganController::class, 'verifikasi']);
//     // });
