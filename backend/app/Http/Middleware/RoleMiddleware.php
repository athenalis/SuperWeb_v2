<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle($request, Closure $next, ...$roles)
    {
        $user = Auth::user();

        // Pecah roles yang dikirim dari route: bisa pakai "|" atau "," (biar fleksibel)
        $allowed = [];
        foreach ($roles as $r) {
            foreach (preg_split('/[|,]/', (string) $r) as $piece) {
                $piece = trim($piece);
                if ($piece !== '') $allowed[] = $piece;
            }
        }
        $allowed = array_values(array_unique($allowed));

        if (!$user || !in_array($user->role_name, $allowed, true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
