import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/theme.dart';
import '../core/session_manager.dart';
import '../core/config.dart';

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  int _currentStep = 1;
  final TextEditingController _passwordCtrl = TextEditingController();
  final TextEditingController _phraseCtrl = TextEditingController();
  bool _understandChecked = false;
  bool _isReauthenticated = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _phraseCtrl.dispose();
    super.dispose();
  }

  // ── 1. Re-authentication via Firebase Auth ──────────────────────────────────
  Future<void> _handleReauthentication() async {
    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('No active user session found. Please log in again.');
      }

      final isGoogleUser = user.providerData.any((p) => p.providerId == 'google.com');

      if (isGoogleUser) {
        final googleSignIn = GoogleSignIn();
        await googleSignIn.signOut(); // Force Google account picker modal to appear every time
        final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
        if (googleUser == null) {
          throw Exception('Google re-authentication cancelled.');
        }

        if (user.email != null && googleUser.email.toLowerCase() != user.email!.toLowerCase()) {
          await googleSignIn.signOut();
          throw Exception('Selected account (${googleUser.email}) does not match logged-in account (${user.email}). Please select the correct Google account.');
        }

        final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
        final credential = GoogleAuthProvider.credential(
          accessToken: googleAuth.accessToken,
          idToken: googleAuth.idToken,
        );
        await user.reauthenticateWithCredential(credential);
      } else {
        final password = _passwordCtrl.text.trim();
        if (password.isEmpty) {
          throw Exception('Please enter your account password.');
        }
        final email = user.email;
        if (email == null) {
          throw Exception('User email missing.');
        }
        final credential = EmailAuthProvider.credential(email: email, password: password);
        await user.reauthenticateWithCredential(credential);
      }

      setState(() {
        _isReauthenticated = true;
        _currentStep = 3;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  // ── 2. Submit Account Deletion Request ─────────────────────────────────────
  Future<void> _submitAccountDeletion() async {
    if (!_understandChecked) {
      setState(() => _errorMessage = 'You must confirm that you understand this action cannot be undone.');
      return;
    }

    if (_phraseCtrl.text.trim() != 'DELETE MY ACCOUNT') {
      setState(() => _errorMessage = 'Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }

    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('Authentication session expired.');

      final idToken = await user.getIdToken(true);
      final baseUrl = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
      final uri = Uri.parse('$baseUrl/api/account/deletion-request');

      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({
          'confirmPhrase': 'DELETE MY ACCOUNT',
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 202) {
        // Account marked disabled on server. Teardown local device session.
        await SessionManager.clearSession();
        await FirebaseAuth.instance.signOut();

        if (mounted) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 24),
                  SizedBox(width: 8),
                  Text('Account Deleted'),
                ],
              ),
              content: const Text(
                'Your DravYantra account deletion request has been submitted and processing has begun. All eligible personal and fleet data will be purged.',
                style: TextStyle(fontSize: 13, height: 1.4),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    context.go('/login');
                  },
                  child: const Text('Return to Login', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          );
        }
      } else {
        String msg = 'Server returned error ${response.statusCode}';
        try {
          final errJson = jsonDecode(response.body);
          if (errJson is Map && errJson.containsKey('error')) {
            msg = errJson['error'].toString();
          } else if (errJson is Map && errJson.containsKey('message')) {
            msg = errJson['message'].toString();
          }
        } catch (_) {
          msg = 'Server endpoint unavailable (${response.statusCode}). Please try again later.';
        }
        throw Exception(msg);
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Delete Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Step Progress Indicator
            Row(
              children: [
                _stepBubble(1, 'Warning'),
                _stepLine(),
                _stepBubble(2, 'Re-Auth'),
                _stepLine(),
                _stepBubble(3, 'Confirm'),
              ],
            ),
            const SizedBox(height: 24),

            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.danger.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.danger, fontSize: 13))),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            if (_currentStep == 1) _buildStep1Consequences(),
            if (_currentStep == 2) _buildStep2Reauthentication(),
            if (_currentStep == 3) _buildStep3ConfirmationPhrase(),
          ],
        ),
      ),
    );
  }

  Widget _stepBubble(int step, String label) {
    final active = _currentStep >= step;
    return Column(
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: active ? AppTheme.danger : Colors.grey.shade300,
          child: Text('$step', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: active ? Colors.white : Colors.grey.shade600)),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 10, color: active ? AppTheme.textPrimary : AppTheme.textSecondary)),
      ],
    );
  }

  Widget _stepLine() {
    return Expanded(
      child: Container(height: 2, color: Colors.grey.shade300, margin: const EdgeInsets.symmetric(horizontal: 4)),
    );
  }

  // ── STEP 1 UI ───────────────────────────────────────────────────────────────
  Widget _buildStep1Consequences() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.red.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.red.shade200),
          ),
          child: const Row(
            children: [
              Icon(LucideIcons.alertOctagon, color: AppTheme.danger, size: 28),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Permanent Action Notice', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.danger, fontSize: 15)),
                    SizedBox(height: 4),
                    Text('Account deletion is irreversible. Your access will be terminated immediately.', style: TextStyle(fontSize: 12, color: Colors.black87)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        const Text('Data That Will Be Permanently Deleted:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 8),
        _bulletItem('Personal Profile & login credentials'),
        _bulletItem('Fleet Vehicles & Driver profiles'),
        _bulletItem('Trip records & GPS location breadcrumbs'),
        _bulletItem('Uploaded Documents (Aadhaar, License, RC, PUC, Insurance, e-Way bills)'),
        _bulletItem('Fuel theft alerts, baselines & savings wallets'),
        _bulletItem('Push notification settings & alert thresholds'),

        const SizedBox(height: 16),
        const Text('Data That May Be Retained:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 8),
        _bulletItem('Tax Invoices & Subscription transaction records (anonymized for tax compliance)'),
        _bulletItem('Security Audit Logs (pseudonymized user references)'),
        _bulletItem('Hardware GPS devices are unassigned and returned to inventory'),

        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: () => setState(() => _currentStep = 2),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.danger,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Proceed to Re-authentication', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _bulletItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.danger)),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  // ── STEP 2 UI ───────────────────────────────────────────────────────────────
  Widget _buildStep2Reauthentication() {
    final user = FirebaseAuth.instance.currentUser;
    final isGoogle = user?.providerData.any((p) => p.providerId == 'google.com') ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Step 2: Re-authenticate Account Ownership', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        Text('For security, verify your identity using your ${isGoogle ? 'Google Account' : 'password'}.', style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
        const SizedBox(height: 20),

        if (!isGoogle) ...[
          TextField(
            controller: _passwordCtrl,
            obscureText: true,
            decoration: InputDecoration(
              labelText: 'Current Password',
              prefixIcon: const Icon(LucideIcons.lock),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 20),
        ],

        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            onPressed: _isSubmitting ? null : _handleReauthentication,
            icon: _isSubmitting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Icon(isGoogle ? LucideIcons.chrome : LucideIcons.keyRound, color: Colors.white),
            label: Text(
              _isSubmitting ? 'Verifying...' : (isGoogle ? 'Re-authenticate with Google' : 'Verify Password & Continue'),
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryBlue,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ],
    );
  }

  // ── STEP 3 UI ───────────────────────────────────────────────────────────────
  Widget _buildStep3ConfirmationPhrase() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Step 3: Final Confirmation', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        const Text('Please read carefully and type the required confirmation phrase below.', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
        const SizedBox(height: 20),

        CheckboxListTile(
          value: _understandChecked,
          onChanged: (val) => setState(() => _understandChecked = val ?? false),
          title: const Text('I understand that account deletion is permanent and cannot be undone.', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          activeColor: AppTheme.danger,
        ),
        const SizedBox(height: 16),

        const Text('Type "DELETE MY ACCOUNT" in all capital letters:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(
          controller: _phraseCtrl,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'DELETE MY ACCOUNT',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppTheme.danger, width: 2),
            ),
          ),
        ),
        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: (_isSubmitting || !_understandChecked || _phraseCtrl.text.trim() != 'DELETE MY ACCOUNT')
                ? null
                : _submitAccountDeletion,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.danger,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _isSubmitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Delete Account Permanently', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }
}
