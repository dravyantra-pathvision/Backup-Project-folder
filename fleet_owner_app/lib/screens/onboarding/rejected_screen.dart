import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/session_manager.dart';
import '../../services/onboarding_service.dart';

class RejectedScreen extends StatefulWidget {
  const RejectedScreen({super.key});

  @override
  State<RejectedScreen> createState() => _RejectedScreenState();
}

class _RejectedScreenState extends State<RejectedScreen> {
  String? _reason;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    try {
      final status = await OnboardingService.getStatus();
      setState(() {
        _reason = status['rejection_reason'];
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading status: $e');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    await SessionManager.clearSession();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

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
        title: const Text('Application Rejected'),
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
              Icon(LucideIcons.xCircle, size: 80, color: AppTheme.danger),
              const SizedBox(height: 24),
              const Text(
                'Application Rejected',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              const Text(
                'Unfortunately, your organization application has been rejected by the administrator.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Colors.black54),
              ),
              if (_reason != null && _reason!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    'Reason: $_reason',
                    style: TextStyle(color: Colors.red.shade900),
                  ),
                ),
              ],
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: () => context.go('/onboarding-wizard'), // Allow them to resubmit
                icon: const Icon(LucideIcons.edit3),
                label: const Text('Update Application'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
