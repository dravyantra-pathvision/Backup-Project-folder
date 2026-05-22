import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'screens/splash_screen.dart';

import 'screens/signup_screen.dart';
import 'screens/login_screen.dart';

import 'screens/admin_dashboard_screen.dart';
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
import 'widgets/scaffold_with_nav.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();
final shellNavigatorKey = GlobalKey<NavigatorState>();

CustomTransitionPage buildPageWithDefaultTransition<T>({
  required BuildContext context,
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        FadeTransition(opacity: animation, child: child),
  );
}

NoTransitionPage buildNoTransitionPage<T>({
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
  initialLocation: '/login',
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
      path: '/admin',
      pageBuilder: (context, state) => buildPageWithDefaultTransition(
        context: context, state: state, child: const AdminDashboardScreen()),
    ),
    ShellRoute(
      navigatorKey: shellNavigatorKey,
      builder: (context, state, child) {
        return ScaffoldWithNav(child: child);
      },
      routes: [
        GoRoute(
          path: '/dashboard',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const DashboardScreen()),
        ),
        GoRoute(
          path: '/live-tracking',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const LiveTrackingScreen()),
        ),
        GoRoute(
          path: '/vehicles',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const VehiclesScreen()),
        ),
        GoRoute(
          path: '/drivers',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const DriversScreen()),
        ),
        GoRoute(
          path: '/trips',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const TripsScreen()),
        ),
        GoRoute(
          path: '/fuel',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const FuelScreen()),
        ),
        GoRoute(
          path: '/alerts',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const AlertsScreen()),
        ),
        GoRoute(
          path: '/analytics',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const AnalyticsScreen()),
        ),
        GoRoute(
          path: '/reports',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const ReportsScreen()),
        ),
        GoRoute(
          path: '/settings',
          pageBuilder: (context, state) => buildNoTransitionPage(state: state, child: const SettingsScreen()),
        ),
      ],
    ),
  ],
);
