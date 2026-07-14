import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';
import '../core/session_manager.dart';
import '../services/onboarding_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    _scaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutBack),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: const Interval(0.0, 0.6, curve: Curves.easeIn)),
    );

    _animationController.forward();
    _checkSessionAndNavigate();
  }

  /// Checks for a valid saved session via SessionManager.
  /// If valid (session < 7 days old) → fetches onboarding status and routes appropriately.
  /// Otherwise → goes to login for fresh login.
  Future<void> _checkSessionAndNavigate() async {
    // Wait at least 1.5s so the animation completes
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    final role = await SessionManager.getValidSession();

    if (!mounted) return;

    if (role != null) {
      try {
        final status = await OnboardingService.getStatus();
        if (!mounted) return;
        
        final orgStatus = status['status'];
        
        if (orgStatus == 'Approved') {
          context.go('/dashboard');
        } else if (orgStatus == 'Pending Review') {
          context.go('/pending-approval');
        } else if (orgStatus == 'Rejected') {
          context.go('/rejected');
        } else {
          context.go('/onboarding-wizard');
        }
      } catch (e) {
        debugPrint('Error fetching onboarding status in splash: $e');
        context.go('/login');
      }
    } else {
      // No valid session — go to login
      context.go('/login');
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    double screenWidth = MediaQuery.of(context).size.width;
    double logoSize = screenWidth > 800 ? 480 : screenWidth * 0.55;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Center(
            child: AnimatedBuilder(
              animation: _animationController,
              builder: (context, child) {
                return Opacity(
                  opacity: _fadeAnimation.value,
                  child: Transform.scale(
                    scale: _scaleAnimation.value,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.truck, size: logoSize * 0.4, color: AppTheme.primaryBlue),
                            SizedBox(width: logoSize * 0.1),
                            Icon(LucideIcons.mapPin, size: logoSize * 0.5, color: AppTheme.success),
                            SizedBox(width: logoSize * 0.1),
                            Icon(LucideIcons.fuel, size: logoSize * 0.4, color: AppTheme.warning),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'DravYantra',
                          style: TextStyle(
                            fontSize: logoSize * 0.12,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryBlue,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: AnimatedBuilder(
              animation: _fadeAnimation,
              builder: (context, child) {
                return Opacity(
                  opacity: _fadeAnimation.value,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'from',
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Pathvision Innovations',
                        style: TextStyle(
                          color: AppTheme.primaryBlue,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
