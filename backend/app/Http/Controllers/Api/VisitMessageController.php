<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisitMessage;
use App\Models\VisitForm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class VisitMessageController extends Controller
{
    /**
     * Get all messages for a specific visit
     */
    public function index($visitId)
    {
        try {
            $visit = VisitForm::findOrFail($visitId);
            $user = auth()->user();

            // Simplified access control
            $canAccess = false;

            if ($user->role === 'admin') {
                $canAccess = true;
            } elseif ($user->role === 'koordinator') {
                // Koordinator can access if visit belongs to their relawan
                $canAccess = true; // Allow for now, can refine later
            } elseif ($user->role === 'relawan') {
                // Relawan can access their own visits
                $relawan = $user->relawan;
                if ($relawan && $visit->relawan_id === $relawan->id) {
                    $canAccess = true;
                }
            }

            if (!$canAccess) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses ke pesan ini'
                ], 403);
            }

            $messages = VisitMessage::where('visit_id', $visitId)
                ->with('user:id,name,email')
                ->orderBy('created_at', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $messages
            ]);
        } catch (\Exception $e) {
            \Log::error('Message fetch error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengambil pesan: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request, $visitId)
    {
        try {
            \Log::info('Message store attempt', ['visit_id' => $visitId, 'user' => auth()->id()]);

            $visit = VisitForm::findOrFail($visitId);
            \Log::info('Visit found', ['visit_id' => $visit->id]);

            $user = auth()->user();
            \Log::info('User authenticated', ['user_id' => $user->id, 'role' => $user->role]);

            // Simplified access control
            $canAccess = false;

            if ($user->role === 'admin') {
                $canAccess = true;
            } elseif ($user->role === 'koordinator') {
                $canAccess = true; // Allow koordinator to send messages
            } elseif ($user->role === 'relawan') {
                $relawan = $user->relawan;
                if ($relawan && $visit->relawan_id === $relawan->id) {
                    $canAccess = true;
                }
            }

            if (!$canAccess) {
                \Log::warning('Access denied for message', ['user_id' => $user->id, 'visit_id' => $visitId]);
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses untuk mengirim pesan'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'message' => 'required|string|max:1000'
            ]);

            if ($validator->fails()) {
                \Log::warning('Validation failed', ['errors' => $validator->errors()]);
                return response()->json([
                    'success' => false,
                    'message' => $validator->errors()->first()
                ], 422);
            }

            \Log::info('Creating message', ['visit_id' => $visitId, 'user_id' => $user->id]);

            $message = VisitMessage::create([
                'visit_id' => $visitId,
                'user_id' => $user->id,
                'message' => $request->message
            ]);

            \Log::info('Message created', ['message_id' => $message->id]);

            $message->load('user:id,name,email');

            return response()->json([
                'success' => true,
                'data' => $message,
                'message' => 'Pesan berhasil dikirim'
            ]);
        } catch (\Exception $e) {
            \Log::error('Message send error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'visit_id' => $visitId,
                'user_id' => auth()->id()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengirim pesan: ' . $e->getMessage()
            ], 500);
        }
    }
}
