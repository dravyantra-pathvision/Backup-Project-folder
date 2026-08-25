import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/session_manager.dart';
import '../../services/onboarding_service.dart';

import 'dart:async';

class PendingApprovalScreen extends StatefulWidget {
  const PendingApprovalScreen({super.key});

  @override
  State<PendingApprovalScreen> createState() => _PendingApprovalScreenState();
}

class _PendingApprovalScreenState extends State<PendingApprovalScreen> {
  bool _isChecking = false;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _startAutoPolling();
  }

  void _startAutoPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) => _checkStatus(silent: true));
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkStatus({bool silent = false}) async {
    if (!silent) setState(() => _isChecking = true);
    try {
      final status = await OnboardingService.getStatus();
      final orgStatus = status['status'];
      
      if (!mounted) return;
      
      if (orgStatus == 'Approved') {
        _pollingTimer?.cancel();
        context.go('/dashboard');
      } else if (orgStatus == 'Rejected') {
        _pollingTimer?.cancel();
        context.go('/rejected');
      } else if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Still pending approval.')),
        );
      }
    } catch (e) {
      debugPrint('Error checking status: $e');
    } finally {
      if (!silent && mounted) setState(() => _isChecking = false);
    }
  }

  Future<void> _logout() async {
    _pollingTimer?.cancel();
    await SessionManager.clearSession();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          tooltip: 'Back',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/login');
            }
          },
        ),
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
