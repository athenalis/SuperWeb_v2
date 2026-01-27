<?php

namespace App\Helpers;

class PhoneHelper
{
    public static function normalize(?string $phone): ?string
    {
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

        return $phone;
    }
}
