<?php

namespace App\Models;

use App\Models\Role;
use App\Models\Relawan;
use App\Models\CourierApk;
use App\Models\CoordinatorApk;
use App\Models\CoordinatorVisit;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

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
        return $this->hasOne(CoordinatorApk::class, 'user_id', 'id');
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
            'user_id',
            'id',         // PK di paslons
            'id',         // PK di users
            'paslon_id'
        );
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function adminApk()
    {
        return $this->hasOne(AdminApk::class, 'user_id', 'id');
    }

    public function apkKurir()
    {
        return $this->hasOne(CourierApk::class, 'user_id', 'id');
    }

    public function getRoleNameAttribute()
    {
        return $this->role?->role;
    }

    public function getRoleSlugAttribute()
    {
        return $this->role?->role;
    }

    public function credential()
    {
        return $this->hasOne(UserCredential::class, 'user_id', 'id');
    }

    public function activeCredential()
    {
        return $this->hasOne(UserCredential::class, 'user_id', 'id')
            ->where('is_active', 1)
            ->latest('id');
    }

    public function hasRole(string $slug): bool
    {
        if ($this->relationLoaded('role') || method_exists($this, 'role')) {
            return $this->role?->role === $slug; 
        }

        return false;
    }
}
