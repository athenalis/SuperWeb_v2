<?php

namespace App\Helpers;

class PhoneHelper
{
    protected static ?string $lastError = null;

    public static function lastError(): ?string
    {
        return self::$lastError;
    }

    public static function normalize(?string $phone): ?string
    {
        self::$lastError = null;

        if (!$phone) {
            return null;
        }

        $phone = preg_replace('/[^0-9]/', '', $phone);

        if (str_starts_with($phone, '62')) {
            $phone = '0' . substr($phone, 2);
        }

        if (!str_starts_with($phone, '0')) {
            $phone = '0' . $phone;
        }

        if (str_starts_with($phone, '021')) {
            self::$lastError = 'Nomor HP tidak boleh diawali 021.';
            return null;
        }

        return $phone;
    }
}
