<?php

namespace App\Helpers;

use App\Models\History;
use Illuminate\Support\Facades\Auth;

class ActivityLogger
{
    private static function normalizeRole($user): ?string
    {
        if (!$user) return null;

        if (isset($user->getAttributes()['role']) && is_string($user->getAttributes()['role'])) {
            return $user->getAttributes()['role'];
        }

        if (is_object($user->role) && isset($user->role->role)) {
            return $user->role->role;
        }

        if (is_array($user->role) && isset($user->role['role'])) {
            return $user->role['role'];
        }

        if (isset($user->role_name) && is_string($user->role_name)) {
            return $user->role_name;
        }

        return null;
    }

    public static function log(array $data)
    {
        $user = Auth::user();

        $roleValue = null;

        if (is_object($user?->role) && isset($user->role->role)) {
            $roleValue = $user->role->role;
        } else {
            $roleValue = $user?->role;
        }

        History::create([
            'user_id'     => $user?->id,
            'role'        => self::normalizeRole($user),
            'action'      => $data['action'],
            'target_type' => $data['target_type'] ?? null,
            'target_name' => $data['target_name'] ?? null,
            'field'       => $data['field'] ?? $data['target_type'] ?? '-',
            'old_value'   => $data['old_value'] ?? null,
            'new_value'   => $data['new_value'] ?? null,
            'meta'        => $data['meta'] ?? null,
        ]);
    }
}
