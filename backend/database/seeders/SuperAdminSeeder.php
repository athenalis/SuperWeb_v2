<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserCredential;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Crypt;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminEmail = 'superadmin@gmail.com';
        $superAdminPassword = 'superadmin123';

        $superAdmin = User::firstOrCreate(
            ['email' => $superAdminEmail],
            [
                'name'     => 'Super Admin',
                'password' => Hash::make($superAdminPassword),
                'role_id'  => 1,
            ]
        );

        if (! UserCredential::where('user_id', $superAdmin->id)->exists()) {
            UserCredential::create([
                'user_id'            => $superAdmin->id,
                'encrypted_password' => Crypt::encryptString($superAdminPassword),
                'type'               => 'initial',
                'is_active'          => true,
            ]);
        }

        $accounts = [
            [
                'name'     => 'Admin APK',
                'email'    => 'admin_apk@gmail.com',
                'password' => 'adminapk123',
                'role_id'  => 3,
            ],
            [
                'name'     => 'Admin Paslon',
                'email'    => 'admin_paslon@gmail.com',
                'password' => 'adminpaslon123',
                'role_id'  => 2,
            ],
            [
                'name'     => 'APK Koordinator',
                'email'    => 'apk_koordinator@gmail.com',
                'password' => 'apkkoor123',
                'role_id'  => 5,
            ],
            [
                'name'     => 'APK Kurir',
                'email'    => 'apk_kurir@gmail.com',
                'password' => 'apkkurir123',
                'role_id'  => 7,
            ],
            [
                'name'     => 'Kunjungan Koordinator',
                'email'    => 'kunjungan_koordinator@gmail.com',
                'password' => 'kunjung123',
                'role_id'  => 4,
            ],
            [
                'name'     => 'Relawan',
                'email'    => 'relawan@gmail.com',
                'password' => 'relawan123',
                'role_id'  => 6,
            ],
        ];

        foreach ($accounts as $acc) {
            $user = User::firstOrCreate(
                ['email' => $acc['email']],
                [
                    'name'     => $acc['name'],
                    'password' => Hash::make($acc['password']),
                    'role_id'  => $acc['role_id'],
                ]
            );

            if (! UserCredential::where('user_id', $user->id)->exists()) {
                UserCredential::create([
                    'user_id'            => $user->id,
                    'encrypted_password' => Crypt::encryptString($acc['password']),
                    'type'               => 'initial',
                    'is_active'          => true,
                ]);
            }
        }
    }
}
