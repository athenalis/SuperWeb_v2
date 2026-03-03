<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrackingSession;
use App\Models\Relawan;
use App\Models\CourierApk; // pastikan modelnya ada
use Illuminate\Http\Request;
use Carbon\Carbon;

class TrackingController extends Controller
{
    private function resolveApkActor($user): array
    {
        $relawan = Relawan::where('user_id', $user->id)->first();
        if ($relawan) {
            if ((int) $relawan->is_apk !== 1) {
                abort(response()->json(['message' => 'Relawan tidak punya tugas APK'], 403));
            }

            return [
                'paslon_id' => $relawan->paslon_id,
                'relawan_id' => $relawan->id,
                'apk_kurir_id' => null,
                'actor' => 'relawan',
            ];
        }

        $kurir = CourierApk::where('user_id', $user->id)->first();
        if ($kurir) {
            return [
                'paslon_id' => $kurir->paslon_id,
                'relawan_id' => null,
                'apk_kurir_id' => $kurir->id,
                'actor' => 'apk_kurir',
            ];
        }

        abort(response()->json(['message' => 'Akses ditolak: bukan relawan APK / kurir APK'], 403));
    }

    private function distanceMeters($lat1, $lon1, $lat2, $lon2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2 +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) ** 2;

        return 2 * $earthRadius * atan2(sqrt($a), sqrt(1 - $a));
    }

    public function start(Request $request)
    {
        $user = $request->user();
        $actor = $this->resolveApkActor($user);

        TrackingSession::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->update(['ended_at' => now()]);

        $session = TrackingSession::create([
            'user_id' => $user->id,
            'paslon_id' => $actor['paslon_id'],
            'relawan_id' => $actor['relawan_id'],
            'apk_kurir_id' => $actor['apk_kurir_id'],

            'started_at' => now(),
            'last_ping_at' => now(),
            'last_moved_at' => now(),
            'idle_started_at' => null,
            'idle_alerted_at' => null,
        ]);

        return response()->json(['session_id' => $session->id, 'actor' => $actor['actor']]);
    }

    public function ping(Request $request)
    {
        $user = $request->user();
        $this->resolveApkActor($user);

        $data = $request->validate([
            'session_id' => 'required|integer',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'pinged_at' => 'required|date',
        ]);

        $session = TrackingSession::where('id', $data['session_id'])
            ->where('user_id', $user->id)
            ->whereNull('ended_at')
            ->firstOrFail();

        $pingTime = Carbon::parse($data['pinged_at']);
        $lat = (float) $data['latitude'];
        $lng = (float) $data['longitude'];

        if (!$session->last_latitude || !$session->last_longitude) {
            $session->update([
                'last_latitude' => $lat,
                'last_longitude' => $lng,
                'last_ping_at' => $pingTime,
                'last_moved_at' => $pingTime,
                'idle_started_at' => null,
                'idle_alerted_at' => null,
            ]);
            return response()->json(['alert' => false]);
        }

        $distance = $this->distanceMeters(
            (float)$session->last_latitude,
            (float)$session->last_longitude,
            $lat,
            $lng
        );

        $MOVE_LIMIT = 25; // meter
        $IDLE_LIMIT = 30; // menit

        $session->last_ping_at = $pingTime;

        if ($distance >= $MOVE_LIMIT) {
            $session->update([
                'last_latitude' => $lat,
                'last_longitude' => $lng,
                'last_moved_at' => $pingTime,
                'idle_started_at' => null,
                'idle_alerted_at' => null,
            ]);

            return response()->json(['alert' => false]);
        }

        if (!$session->idle_started_at) {
            $session->idle_started_at = $pingTime;
        }

        $idleMinutes = $pingTime->diffInMinutes($session->idle_started_at);
        $alert = $idleMinutes >= $IDLE_LIMIT && !$session->idle_alerted_at;

        if ($alert) {
            $session->idle_alerted_at = $pingTime;
        }

        $session->save();

        return response()->json([
            'alert' => $alert,
            'idle_minutes' => $idleMinutes,
            'message' => $alert ? 'Anda tidak bergerak selama 30 menit' : null
        ]);
    }

    public function stop(Request $request)
    {
        $user = $request->user();
        $this->resolveApkActor($user);

        $request->validate(['session_id' => 'required|integer']);

        TrackingSession::where('id', $request->session_id)
            ->where('user_id', $user->id)
            ->update(['ended_at' => now()]);

        return response()->json(['message' => 'session stopped']);
    }
}
