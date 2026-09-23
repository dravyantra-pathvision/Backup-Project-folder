import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'screens/splash_screen.dart';

import 'screens/signup_screen.dart';
import 'screens/login_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/verify_otp_screen.dart';

import 'screens/dashboard_screen.dart';
import 'screens/live_tracking_screen.dart';
import 'screens/vehicles_screen.dart';
import 'screens/drivers_screen.dart';
import 'screens/fuel_screen.dart';
import 'screens/trips_screen.dart';
import 'screens/alerts_screen.dart';
import 'screens/analytics_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/support_tickets_screen.dart';
import 'screens/create_ticket_screen.dart';
import 'screens/ticket_detail_screen.dart';
import 'screens/savings_wallet_screen.dart';
import 'screens/carbon_analytics_screen.dart';
import 'screens/fuel_consumed_screen.dart';
import 'screens/fuel_loss_screen.dart';
import 'screens/report_detail_screen.dart';
import 'widgets/scaffold_with_nav.dart';

import 'screens/onboarding/wizard_screen.dart';
import 'screens/onboarding/pending_approval_screen.dart';
import 'screens/onboarding/rejected_screen.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();
final shellNavigatorKey = GlobalKey<NavigatorState>();

CustomTransitionPage<T> buildPageWithDefaultTransition<T>({
  required BuildContext context,
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 320),
    reverseTransitionDuration: const Duration(milliseconds: 220),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final fadeAnim = CurvedAnimation(parent: animation, curve: Curves.easeOut);
      final slideAnim = Tween<Offset>(
        begin: const Offset(0.04, 0.0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

      // Secondary: slide outward when route is pushed away
      final secondarySlide = Tween<Offset>(
        begin: Offset.zero,
        end: const Offset(-0.04, 0.0),
      ).animate(CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeIn));

      return SlideTransition(
        position: secondarySlide,
        child: SlideTransition(
          position: slideAnim,
          child: FadeTransition(opacity: fadeAnim, child: child),
        ),
      );
    },
  );
}

NoTransitionPage<T> buildNoTransitionPage<T>({
  required GoRouterState state,
  required Widget child,
}) {
  return NoTransitionPage<T>(
    key: ValueKey(state.uri.toString()),
    child: child,
  );
}

final GoRouter appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const SplashScreen()),
    ),

    GoRoute(
      path: '/login',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const LoginScreen()),
    ),
    GoRoute(
      path: '/signup',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const SignupScreen()),
    ),
    GoRoute(
      path: '/forgot-password',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const ForgotPasswordScreen()),
    ),
    GoRoute(
      path: '/verify-otp',
      pageBuilder: (context, state) {
        final verificationId = state.uri.queryParameters['verificationId'] ?? '';
        final phoneNumber = state.uri.queryParameters['phoneNumber'] ?? '';
        final role = state.uri.queryParameters['role'] ?? 'fleet_owner';
        return buildPageWithDefaultTransition(
          context: context,
          state: state,
          child: VerifyOtpScreen(
            verificationId: verificationId,
            phoneNumber: phoneNumber,
            role: role,
          ),
        );
      },
    ),
    GoRoute(
      path: '/onboarding-wizard',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const OnboardingWizardScreen()),
    ),
    GoRoute(
      path: '/pending-approval',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const PendingApprovalScreen()),
    ),
    GoRoute(
      path: '/rejected',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const RejectedScreen()),
    ),

    ShellRoute(
      navigatorKey: shellNavigatorKey,
      builder: (context, state, child) {
        return ScaffoldWithNav(child: child);
      },
      routes: [
        GoRoute(
          path: '/dashboard',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const DashboardScreen()),
        ),
        GoRoute(
          path: '/live-tracking',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const LiveTrackingScreen()),
        ),
        GoRoute(
          path: '/vehicles',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const VehiclesScreen()),
        ),
        GoRoute(
          path: '/drivers',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const DriversScreen()),
        ),
        GoRoute(
          path: '/trips',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const TripsScreen()),
        ),
        GoRoute(
          path: '/fuel',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const FuelScreen()),
        ),
        GoRoute(
          path: '/alerts',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const AlertsScreen()),
        ),
        GoRoute(
          path: '/analytics',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const AnalyticsScreen()),
        ),
        GoRoute(
          path: '/reports',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const ReportsScreen()),
        ),
        GoRoute(
          path: '/settings',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const SettingsScreen()),
        ),
        GoRoute(
          path: '/support',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const SupportTicketsScreen()),
        ),
        GoRoute(
          path: '/support/create',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const CreateTicketScreen()),
        ),
        GoRoute(
          path: '/support/:id',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: TicketDetailScreen(ticketNumber: state.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/savings-wallet',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const SavingsWalletScreen()),
        ),
        GoRoute(
          path: '/carbon-analytics',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const CarbonAnalyticsScreen()),
        ),
        GoRoute(
          path: '/fuel-consumed',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const FuelConsumedScreen()),
        ),
        GoRoute(
          path: '/fuel-loss',
          pageBuilder: (context, state) =>
              buildNoTransitionPage(state: state, child: const FuelLossScreen()),
        ),
        GoRoute(
          path: '/report-detail',
          pageBuilder: (context, state) {
            final type = state.uri.queryParameters['type'] ?? 'fleet_performance';
            return buildNoTransitionPage(state: state, child: ReportDetailScreen(reportType: type));
          },
        ),
      ],
    ),
  ],
);
