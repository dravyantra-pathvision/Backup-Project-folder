import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';
import '../core/session_manager.dart';

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
  /// If valid (Firebase user + session < 7 days old) → goes straight to dashboard.
  /// Otherwise → goes to role-selection for fresh login.
  Future<void> _checkSessionAndNavigate() async {
    // Wait at least 1.5s so the animation completes
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    final role = await SessionManager.getValidSession();

    if (!mounted) return;

    if (role != null) {
      // Valid session — skip login entirely
      if (role == 'admin') {
        context.go('/admin');
      } else {
        context.go('/dashboard');
      }
    } else {
      // No valid session — show role selection for fresh login
      context.go('/role-selection');
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
      body: Center(
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
    );
  }
}
