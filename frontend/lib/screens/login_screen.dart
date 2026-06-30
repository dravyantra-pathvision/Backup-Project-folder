import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import '../core/theme.dart';
import '../core/config.dart';
import '../core/session_manager.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import '../models/engine.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailOrPhone = TextEditingController();
  final _pass = TextEditingController();
  bool _isLoading = false;
  bool _obscurePass = true;

  String _getRole(BuildContext context) {
    try {
      return GoRouterState.of(context).uri.queryParameters['role'] ?? 'fleet_owner';
    } catch (_) {
      return 'fleet_owner';
    }
  }

  String _getRoleLabel(String role) {
    switch (role) {
      case 'fleet_owner':
        return 'Fleet Owner';
      case 'driver':
        return 'Driver';
      case 'admin':
        return 'Admin Dashboard';
      default:
        return 'Fleet Owner';
    }
  }

  Future<void> _handleLogin() async {
    if (_emailOrPhone.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter Email')));
      return;
    }

    final input = _emailOrPhone.text.trim();
    final role = _getRole(context);

    if (_pass.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter password')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: input,
        password: _pass.text,
      );
      
      final user = cred.user;
      if (user != null) {
        if (!user.emailVerified) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please verify your email address before logging in.')));
          await FirebaseAuth.instance.signOut();
          await GoogleSignIn().signOut();
          Provider.of<DataEngine>(context, listen: false).clearData();
          setState(() => _isLoading = false);
          return;
        }
        await _handleSuccessfulLogin(user, role);
      }
    } on FirebaseAuthException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Login failed')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isLoading = true);
    final role = _getRole(context);
    try {
      if (kIsWeb) {
        final GoogleAuthProvider googleProvider = GoogleAuthProvider();
        // Firebase Auth natively handles the popup and scopes on web, bypassing google_sign_in plugin issues
        final cred = await FirebaseAuth.instance.signInWithPopup(googleProvider);
        final user = cred.user;
        if (user != null) {
          await _handleSuccessfulLogin(user, role);
        }
        return;
      }

      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        setState(() => _isLoading = false);
        return; // User canceled
      }

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final cred = await FirebaseAuth.instance.signInWithCredential(credential);
      final user = cred.user;
      if (user != null) {
        await _handleSuccessfulLogin(user, role);
      }
    } on FirebaseAuthException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Google Sign-In failed')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleSuccessfulLogin(User? user, String role) async {
    if (user == null) return;

    // Save session immediately so app stays logged in for 7 days
    await SessionManager.saveSession(role);

    // Fetch fresh data for the newly logged-in user
    Provider.of<DataEngine>(context, listen: false).refreshData();

    // Navigate first — don't block on backend sync
    if (mounted) {
      if (role == 'driver') {
        // Sign out to prevent partial driver login issues in fleet app
        await SessionManager.clearSession();
        await FirebaseAuth.instance.signOut();
        await GoogleSignIn().signOut();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Access Denied: Drivers are not permitted to access the fleet dashboard.'),
              backgroundColor: AppTheme.danger,
            ),
          );
        }
        context.go('/login?role=driver');
        return;
      } else if (role == 'admin') {
        context.go('/admin');
      } else {
        context.go('/dashboard');
      }
    }

    // Backend sync is fire-and-forget — failure here does NOT block login
    try {
      final token = await user.getIdToken();
      final engine = Provider.of<DataEngine>(context, listen: false);
      await http.post(
        Uri.parse('${engine.baseUrl}/api/users/sync'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'full_name': user.displayName ?? 'User', 'role': role}),
      ).timeout(const Duration(seconds: 8));
    } catch (e) {
      // Sync failed (no WiFi / backend unreachable) — login still succeeds
      debugPrint('Backend sync skipped (offline): $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = _getRole(context);
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 400,
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 20)],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.local_shipping, size: 48, color: AppTheme.primaryBlue),
                const SizedBox(height: 16),
                const Text('DravYantra', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                const SizedBox(height: 4),
                Text(
                  'Portal: ${_getRoleLabel(role)}',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _emailOrPhone,
                  decoration: const InputDecoration(
                    labelText: 'Email', 
                    hintText: 'Enter email',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _pass,
                  obscureText: _obscurePass,
                  decoration: InputDecoration(
                    labelText: 'Password', 
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePass ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscurePass = !_obscurePass),
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      context.go('/forgot-password');
                    },
                    child: const Text('Forgot Password?', style: TextStyle(color: AppTheme.primaryBlue)),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryBlue, 
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _isLoading ? null : _handleLogin,
                    child: _isLoading 
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white))
                        : const Text('Login', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text("OR", style: TextStyle(color: Colors.grey))),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _isLoading ? null : _handleGoogleSignIn,
                    icon: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      alignment: Alignment.center,
                      child: const Text('G', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                    label: const Text('Continue with Google', style: TextStyle(fontSize: 16, color: Colors.black87, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: () {
                        context.go('/role-selection');
                      },
                      child: const Row(
                        children: [
                          Icon(Icons.arrow_back, size: 14, color: AppTheme.primaryBlue),
                          SizedBox(width: 4),
                          Text("Back", style: TextStyle(color: AppTheme.primaryBlue)),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        context.go('/signup');
                      },
                      child: const Text("Sign Up", style: TextStyle(color: AppTheme.primaryBlue)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
