import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../core/theme.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String verificationId;
  final String phoneNumber;
  final String role;

  const VerifyOtpScreen({
    super.key,
    required this.verificationId,
    required this.phoneNumber,
    required this.role,
  });

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final _otp = TextEditingController();
  bool _isLoading = false;

  Future<void> _handleVerifyOtp() async {
    if (_otp.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter the OTP')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: widget.verificationId,
        smsCode: _otp.text.trim(),
      );

      final userCred = await FirebaseAuth.instance.signInWithCredential(credential);
      
      if (userCred.user != null && mounted) {
        if (widget.role == 'driver') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Access Denied: Drivers are not permitted to access the fleet dashboard.'),
              backgroundColor: AppTheme.danger,
            ),
          );
          context.go('/login?role=driver');
        } else if (widget.role == 'admin') {
          context.go('/admin');
        } else {
          context.go('/dashboard');
        }
      }
    } on FirebaseAuthException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message ?? 'Verification failed')));
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
              const Icon(Icons.sms_outlined, size: 48, color: AppTheme.primaryBlue),
              const SizedBox(height: 16),
              const Text('Verify Phone Number', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
              const SizedBox(height: 8),
              Text(
                'Enter the 6-digit OTP sent to ${widget.phoneNumber}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _otp,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(
                  labelText: 'OTP Code', 
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.password),
                  counterText: "",
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
                  onPressed: _isLoading ? null : _handleVerifyOtp,
                  child: _isLoading 
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white))
                      : const Text('Verify and Login', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  context.go('/login?role=${widget.role}');
                },
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.arrow_back, size: 14, color: AppTheme.primaryBlue),
                    SizedBox(width: 4),
                    Text("Back to Login", style: TextStyle(color: AppTheme.primaryBlue)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
