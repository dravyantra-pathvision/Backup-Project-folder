import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import '../core/theme.dart';
import '../core/config.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _isLoading = false;
  bool _obscurePass = true;

  Future<void> _handleLogin() async {
    if (_email.text.isEmpty || _pass.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }

    // Demo credentials check (Bypass Firebase)
    final email = _email.text.trim();
    final pass = _pass.text;
    if ((email == 'admin@drav_yantra.com' && pass == 'password') || 
        (email == 'admin@gmail.com' && pass == 'admin123')) {
      context.go('/dashboard');
      return;
    }

    setState(() => _isLoading = true);
    try {
      final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _email.text.trim(),
        password: _pass.text,
      );
      
      final user = cred.user;
      if (user != null) {
        final token = await user.getIdToken();
        
        // Sync user (updates last login essentially or recreates if missed)
        await http.post(
          Uri.parse('${AppConfig.apiBaseUrl}/api/users/sync'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({'full_name': user.displayName ?? 'User', 'role': 'fleet_owner'}),
        );

        if (mounted) {
          context.go('/dashboard');
        }
      }
    } on FirebaseAuthException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Login failed')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
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
              const Text('Fleet Intelligence Platform', style: TextStyle(color: AppTheme.textSecondary)),
              const SizedBox(height: 32),
              TextField(
                controller: _email,
                decoration: const InputDecoration(
                  labelText: 'Email Address', 
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email_outlined),
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
              const SizedBox(height: 24),
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
              TextButton(
                onPressed: () {
                  context.go('/signup');
                },
                child: const Text("Don't have an account? Sign Up", style: TextStyle(color: AppTheme.primaryBlue)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
