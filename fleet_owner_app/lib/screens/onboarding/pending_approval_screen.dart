import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/session_manager.dart';
import '../../services/onboarding_service.dart';

class PendingApprovalScreen extends StatefulWidget {
  const PendingApprovalScreen({super.key});

  @override
  State<PendingApprovalScreen> createState() => _PendingApprovalScreenState();
}

class _PendingApprovalScreenState extends State<PendingApprovalScreen> {
  bool _isChecking = false;

  Future<void> _checkStatus() async {
    setState(() => _isChecking = true);
    try {
      final status = await OnboardingService.getStatus();
      final orgStatus = status['status'];
      
      if (!mounted) return;
      
      if (orgStatus == 'Approved') {
        context.go('/dashboard');
      } else if (orgStatus == 'Rejected') {
        context.go('/rejected');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Still pending approval.')),
        );
      }
    } catch (e) {
      debugPrint('Error checking status: $e');
    } finally {
      if (mounted) setState(() => _isChecking = false);
    }
  }

  Future<void> _logout() async {
    await SessionManager.clearSession();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Pending Approval'),
        actions: [
          IconButton(icon: const Icon(LucideIcons.logOut), onPressed: _logout),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.clock, size: 80, color: AppTheme.warning),
              const SizedBox(height: 24),
              const Text(
                'Organization Under Review',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              const Text(
                'Your organization profile has been submitted and is currently pending administrator approval. We will notify you once it is approved.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Colors.black54),
              ),
              const SizedBox(height: 32),
              _isChecking
                  ? const CircularProgressIndicator()
                  : ElevatedButton.icon(
                      onPressed: _checkStatus,
                      icon: const Icon(LucideIcons.refreshCw),
                      label: const Text('Check Status'),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
