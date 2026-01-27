<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Role;
use App\Models\Relawan;
use App\Models\Coordinator;
use App\Models\CoordinatorApk;
use App\Models\CoordinatorVisit;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes; // ⬅️ WAJIB coba lu test aja di postman (ara)

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'nik',
        'email',
        'password',
        'role_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function kunjunganKoordinator()
    {
        return $this->hasOne(CoordinatorVisit::class);
    }

    public function apkKoordinator()
    {
        return $this->hasOne(CoordinatorApk::class);
    }

    public function relawan()
    {
        return $this->hasOne(Relawan::class);
    }

    public function adminPaslon()
    {
        return $this->hasOne(AdminPaslon::class);
    }

    public function paslon()
    {
        return $this->hasOneThrough(
            Paslon::class,
            AdminPaslon::class,
            'user_id',    // FK di admin_paslons
            'id',         // PK di paslons
            'id',         // PK di users
            'paslon_id'   // FK ke paslons
        );
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function getRoleNameAttribute()
    {
        return $this->role?->role;
    }
}
