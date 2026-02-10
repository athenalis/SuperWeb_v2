<?php

use App\Models\Party;
use App\Models\Paslon;

use Illuminate\Http\Request;
use App\Models\ContentStatus;

use App\Exports\RelawanApkTemplate;
use App\Exports\KoordinatorTemplate;

use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Analisis;
use App\Exports\RelawanKunjunganTemplate;

use App\Http\Controllers\Api\DptController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrmasController;
use App\Http\Controllers\Api\SuaraController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\PaslonController;

use App\Http\Controllers\Api\ApkItemController;
use App\Http\Controllers\Api\HistoryController;

use App\Http\Controllers\Api\RelawanController;
use App\Http\Controllers\Api\WilayahController;

use App\Http\Controllers\Api\AdminApkController;
use App\Http\Controllers\Api\ApkStockController;
use App\Http\Controllers\Api\MapVisitController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\UnitItemController;

use App\Http\Controllers\Api\ApkBentukController;
use App\Http\Controllers\Api\ApkBudgetController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\KunjunganController;
use App\Http\Controllers\Api\PetaSuaraController;
use App\Http\Controllers\Api\ApkRequestController;
use App\Http\Controllers\Api\CourierApkController;
use App\Http\Controllers\Api\EngagementController;

use App\Http\Controllers\Api\InfluencerController;
use App\Http\Controllers\Api\PetaPartaiController;
use App\Http\Controllers\Api\AdminPaslonController;
use App\Http\Controllers\Api\ContentPlanController;
use App\Http\Controllers\Api\ContentTypeController;
use App\Http\Controllers\Api\CoordinatorController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\CoordinatorApkController;
use App\Http\Controllers\Api\ApkInstallationController;
use App\Http\Controllers\Api\ContentPlatformController;

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

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
    Route::get('/activity-logs', [HistoryController::class, 'index']);
    Route::get('/ormas', [OrmasController::class, 'index']);
    Route::get('/me/wilayah', [AuthController::class, 'wilayah']);
    Route::get('/units', [UnitItemController::class, 'index']);
    Route::get('/apk/bentuks', [ApkBentukController::class, 'index']); // untuk dropdown kategori & bentuk

    Route::prefix('wilayah')->group(function () {
        Route::get('/', [WilayahController::class, 'index']);
        Route::get('cities/{province}', [WilayahController::class, 'cities']);
        Route::get('districts/{city}', [WilayahController::class, 'districts']);
        Route::get('villages/{district}', [WilayahController::class, 'villages']);
        Route::get('pekerjaan', [WilayahController::class, 'pekerjaan']);
    });

    Route::get('/koordinator/template', fn() => Excel::download(new KoordinatorTemplate, 'template_koordinator.xlsx'));

    Route::get(
        '/relawan-kunjungan/template',
        fn() =>
        Excel::download(
            new RelawanKunjunganTemplate,
            'template_relawan_kunjungan.xlsx'
        )
    );

    Route::get(
        '/relawan-apk/template',
        fn() =>
        Excel::download(
            new RelawanApkTemplate,
            'template_relawan_apk.xlsx'
        )
    );

    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
    });
});

/*
|--------------------------------------------------------------------------
| ROLE: superadmin & admin_paslon
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin_paslon|superadmin'])->group(function () {
    Route::prefix('suara')->group(function () {
        Route::get('/paslon', [SuaraController::class, 'paslonCard']);
        Route::get('/diagram-paslon', [SuaraController::class, 'diagramPaslon']);
        Route::get('/diagram-partai', [SuaraController::class, 'diagramPartai']);
    });

    Route::prefix('peta')->group(function () {
        Route::prefix('paslon')->group(function () {
            Route::get('/kota', [PetaSuaraController::class, 'perKota']);
            Route::get('/kecamatan', [PetaSuaraController::class, 'perKecamatan']);
            Route::get('/kelurahan', [PetaSuaraController::class, 'perKelurahan']);
            Route::get('/', [PetaSuaraController::class, 'perKelurahan']);
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

        Route::get('/kunjungan', [MapVisitController::class, 'mapData']);
    });
});

/*
|--------------------------------------------------------------------------
| ROLE: superadmin
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:superadmin'])->group(function () {
    Route::prefix('paslon')->group(function () {
        Route::post('/', [PaslonController::class, 'store']);
        Route::get('/', [PaslonController::class, 'index']);
        Route::get('/{id}', [PaslonController::class, 'show']);
        Route::delete('/{id}', [PaslonController::class, 'destroy']);
    });

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
| APK REQUESTS - read (admin_paslon/admin_apk/apk_koordinator/apk_kurir)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin_apk|admin_paslon|apk_koordinator|apk_kurir'])->group(function () {
    Route::prefix('apk-requests')->group(function () {
        Route::get('/', [ApkRequestController::class, 'index']);
        Route::get('/{id}', [ApkRequestController::class, 'show']);
    });

    Route::get('/apk/items', [ApkItemController::class, 'index']);    
    Route::get('/apk/items/{id}', [ApkItemController::class, 'show']);     
    Route::get('/apk/bentuks', [ApkBentukController::class, 'index']);
    Route::get('/apk/budget', [ApkBudgetController::class, 'index']);
    Route::get('apk/stock/history', [ApkStockController::class, 'history']);
    Route::get('apk/stock/history/{id}', [ApkStockController::class, 'historyItem']);
});

/*
|--------------------------------------------------------------------------
| APK REQUESTS - Admin APK actions (approve/reject)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin_apk'])->group(function () {
    Route::prefix('apk-requests')->group(function () {
        Route::patch('/{id}/approve', [ApkRequestController::class, 'approve']);
        Route::patch('/{id}/reject', [ApkRequestController::class, 'reject']);
    });

    // Fetch couriers for assignment
    Route::get('/apk-kurirs', [CourierApkController::class, 'index']);
});

/*
|--------------------------------------------------------------------------
| APK REQUESTS - Kurir APK actions (pickup/arrive)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:apk_kurir'])->group(function () {
    Route::prefix('apk-requests')->group(function () {
        Route::post('/{id}/pickup', [ApkRequestController::class, 'pickup']);
        Route::post('/{id}/arrive', [ApkRequestController::class, 'arrive']);
    });
});

/*
|--------------------------------------------------------------------------
| ROLE: admin_paslon
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin_paslon'])->group(function () {
    Route::prefix('admin-apk')->group(function () {
        Route::post('/', [AdminApkController::class, 'store']);
        Route::get('/', [AdminApkController::class, 'index']);
        Route::get('/{id}', [AdminApkController::class, 'show']);
        Route::put('/{id}', [AdminApkController::class, 'update']);
    });

    Route::prefix('koordinator')->name('koordinator')->group(function () {
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
    });

    Route::prefix('content-plans')->group(function () {
        Route::get('/', [ContentPlanController::class, 'index']);
        Route::get('/summary', [ContentPlanController::class, 'contentSummary']);
        Route::get('/{id}', [ContentPlanController::class, 'show']);
        Route::post('/', [ContentPlanController::class, 'store']);
        Route::put('/{id}', [ContentPlanController::class, 'update']);
        Route::get('/{id}/analytics', [EngagementController::class, 'analyticContent']);
        Route::post('/{id}/analytics/record', [EngagementController::class, 'store']);
        Route::put('/{id}/analytics/record/{engagementId}', [EngagementController::class, 'update']);
    });

    Route::prefix('dashboard')->group(function () {
        Route::get('/', [DashboardController::class, 'index']);
        Route::get('/progress-bar', [DashboardController::class, 'progressBar']);
        Route::get('/stacked-bar', [DashboardController::class, 'stackedBar']);
        Route::get('/visit-summary', [DashboardController::class, 'visitSummary']);
    });

    Route::prefix('influencers')->group(function () {
        Route::get('/', [InfluencerController::class, 'index']);
        Route::post('/', [InfluencerController::class, 'store']);
        Route::put('/{id}', [InfluencerController::class, 'update']);
        Route::get('/all', [InfluencerController::class, 'all']);
    });

    Route::prefix('persebaran')->group(function () {
        Route::get('/straight-ticket/district', [Analisis::class, 'straightTicketByDistrict']);
    });

    Route::get('/content-statuses', fn() => ContentStatus::select('id', 'label')->get());
    Route::get('/budget', [BudgetController::class, 'index']);
    Route::get('/platforms', [ContentPlatformController::class, 'index']);
    Route::get('/content-types', [ContentTypeController::class, 'index']);
});

/*
|--------------------------------------------------------------------------
| ROLE: admin_paslon | admin_apk | apk_koordinator (Kurir APK read)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:apk_koordinator'])->group(function () {
    Route::prefix('apk-installations')->group(function () {
        Route::get('/{id}/photo', [ApkInstallationController::class, 'photo']);
        Route::get('/', [ApkInstallationController::class, 'index']);
    });
});

// =====================================================
// KOORDINATOR APK
// aturan: admin_apk boleh CRUD, admin_paslon cuma read
// =====================================================

// READ (admin_apk + admin_paslon)
Route::middleware(['auth:sanctum', 'role:admin_apk|admin_paslon'])->prefix('koordinator-apk')->group(function () {
    Route::get('/', [CoordinatorApkController::class, 'index']);
    Route::get('/{id}', [CoordinatorApkController::class, 'show']);
});

/*
|--------------------------------------------------------------------------
| ROLE: admin_apk
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin_apk'])->group(function () {

    // KOORDINATOR APK (WRITE)
    Route::prefix('koordinator-apk')->group(function () {
        Route::post('/', [CoordinatorApkController::class, 'store']);
        Route::put('/{id}', [CoordinatorApkController::class, 'update']);
        Route::delete('/{id}', [CoordinatorApkController::class, 'destroy']);

        Route::post('/import', [CoordinatorApkController::class, 'import']);
        Route::post('/restore-by-nik', [CoordinatorApkController::class, 'restoreByNik']);

        // kalau ini memang admin_apk aja:
        Route::post('/check-nik', [CoordinatorApkController::class, 'checkNik']);
        Route::post('/apk/export', [CoordinatorApkController::class, 'export']);
    });

    // APK MANAGEMENT
    Route::prefix('apk')->group(function () {

        Route::prefix('items')->group(function () {
            Route::post('/', [ApkItemController::class, 'store']);
            Route::put('/{apkItem}', [ApkItemController::class, 'update']);
            Route::delete('/{apkItem}', [ApkItemController::class, 'destroy']);
        });

        Route::prefix('stock')->group(function () {
            Route::post('/in', [ApkStockController::class, 'stockIn']);
            Route::post('/out', [ApkStockController::class, 'stockOut']);
            Route::post('/adjust', [ApkStockController::class, 'stockAdjust']);
        });

        Route::prefix('bentuk')->group(function () {
            Route::get('/', [ApkBentukController::class, 'index']);
            Route::post('/', [ApkBentukController::class, 'store']);
            Route::put('/{id}', [ApkBentukController::class, 'update']);
            Route::delete('/{id}', [ApkBentukController::class, 'destroy']);
        });
    });

    // APK KURIR
    Route::prefix('apk-kurir')->group(function () {
        Route::get('/', [CourierApkController::class, 'index']);
        Route::get('/active', [CourierApkController::class, 'active']);
        Route::get('/{id}', [CourierApkController::class, 'show']);
        Route::post('/', [CourierApkController::class, 'store']);
        Route::put('/{id}', [CourierApkController::class, 'update']);
        Route::delete('/{id}', [CourierApkController::class, 'destroy']);
        Route::post('/export', [CourierApkController::class, 'exportKurir']);
    });
});

/*
|--------------------------------------------------------------------------
| RELAWAN MODULE ✅ DIRAPIKAN (NO DUPLICATE GROUP)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->prefix('relawan')->group(function () {
    Route::middleware('role:admin_paslon|admin_apk|kunjungan_koordinator|apk_koordinator')->group(function () {
        Route::get('/apk', [RelawanController::class, 'indexApk']);
        Route::get('/kunjungan', [RelawanController::class, 'indexKunjungan']);
        Route::get('/apk/{id}', [RelawanController::class, 'showApk']);
        Route::get('/kunjungan/{id}', [RelawanController::class, 'showKunjungan']);

        Route::post('/export-kunjungan', [RelawanController::class, 'exportKunjungan']);
        Route::post('/export-apk', [RelawanController::class, 'exportApk']);
    });

    // ✅ Mutasi data relawan (khusus koor)
    Route::middleware('role:kunjungan_koordinator|apk_koordinator')->group(function () {
        Route::post('/', [RelawanController::class, 'store']);
        Route::put('/{id}', [RelawanController::class, 'update']);
        Route::delete('/{id}', [RelawanController::class, 'destroy']);

        Route::post('/check-nik', [RelawanController::class, 'checkNik']);
        Route::post('/restore', [RelawanController::class, 'restoreByNik']);

        Route::post('/import/kunjungan', [RelawanController::class, 'importKunjungan']);
        Route::post('/import/apk', [RelawanController::class, 'importApk']);
    });

    Route::middleware('role:kunjungan_koordinator')->group(function () {
        Route::patch('/double-job/{id}', [RelawanController::class, 'doubleJobToApkFromKunjungan']);
        Route::get('/double-job/{id}/eligible-apk', [RelawanController::class, 'eligibleApkKoordinatorsForRelawan']);
    });
});

Route::middleware(['auth:sanctum', 'role:apk_koordinator'])->group(function () {

    Route::prefix('apk-requests')->group(function () {
        // Route::get('/', [ApkRequestController::class, 'index']);       // riwayat permintaan
        // Route::get('/{id}', [ApkRequestController::class, 'show']);    // detail permintaan
        Route::post('/', [ApkRequestController::class, 'store']);
        Route::patch('/{id}/revise-items', [ApkRequestController::class, 'reviseItems']);
        Route::post('/{id}/resubmit', [ApkRequestController::class, 'resubmit']);
        Route::post('/{id}/delivered', [ApkRequestController::class, 'delivered']);
        Route::delete('/{id}', [ApkRequestController::class, 'destroy']);
    });
});


/*
|--------------------------------------------------------------------------
| ROLE: relawan | apk_kurir (tracking + installations)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:relawan|apk_kurir'])->prefix('apk')->group(function () {
    Route::prefix('tracking')->group(function () {
        Route::post('/start', [TrackingController::class, 'start']);
        Route::post('/ping',  [TrackingController::class, 'ping']);
        Route::post('/stop',  [TrackingController::class, 'stop']);
    });

    Route::prefix('installations')->group(function () {
        Route::post('/', [ApkInstallationController::class, 'store']);
    });
});

Route::middleware(['auth:sanctum', 'role:relawan|kunjungan_koordinator'])->prefix('kunjungan')->group(function () {
    Route::get('/', [KunjunganController::class, 'index']);
    Route::get('/{id}', [KunjunganController::class, 'show']);
});

// kunjungan - relawan only
Route::middleware(['auth:sanctum', 'role:relawan'])->prefix('kunjungan')->group(function () {
    Route::post('/', [KunjunganController::class, 'store']);
    Route::put('/{id}', [KunjunganController::class, 'update']);
    Route::delete('/{id}', [KunjunganController::class, 'destroy']);
    Route::post('/{kunjungan_id}/anggota', [KunjunganController::class, 'tambahAnggota']);
    Route::put('/anggota/{anggota_id}', [KunjunganController::class, 'updateAnggota']);
    Route::delete('/anggota/{anggota_id}', [KunjunganController::class, 'hapusAnggota']);
    Route::post('/{kunjungan_id}/selesai', [KunjunganController::class, 'selesaikanKunjungan']);
    Route::post('/ocr-ktp', [KunjunganController::class, 'ocrKtp']);
    Route::get('/summary-kunjungan', [KunjunganController::class, 'index']);
    Route::post('/check-nik', [KunjunganController::class, 'checkNik']);
});

// kunjungan - koor only
Route::middleware(['auth:sanctum', 'role:kunjungan_koordinator'])->prefix('kunjungan')->group(function () {
    Route::get('/batch/next', [KunjunganController::class, 'getNextBatch']);
    Route::post('/{id}/verifikasi', [KunjunganController::class, 'verifikasi']);
});
