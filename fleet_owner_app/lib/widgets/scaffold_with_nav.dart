import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/engine.dart';
import '../core/session_manager.dart';
import 'animated_widgets.dart';

class ScaffoldWithNav extends StatelessWidget {
  final Widget child;

  const ScaffoldWithNav({super.key, required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final String location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/vehicles')) return 1;
    if (location.startsWith('/drivers')) return 2;
    if (location.startsWith('/trips')) return 3;
    if (location.startsWith('/settings')) return 4;
    return 0;
  }

  bool _isNavActive(BuildContext context) {
    final String location = GoRouterState.of(context).uri.toString();
    return location.startsWith('/dashboard') ||
        location.startsWith('/vehicles') ||
        location.startsWith('/drivers') ||
        location.startsWith('/trips') ||
        location.startsWith('/settings');
  }

  void _onItemTapped(int index, BuildContext context) {
    HapticFeedback.selectionClick();
    switch (index) {
      case 0: context.go('/dashboard'); break;
      case 1: context.go('/vehicles'); break;
      case 2: context.go('/drivers'); break;
      case 3: context.go('/trips'); break;
      case 4: context.go('/settings'); break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final bool isSmallScreen = constraints.maxWidth < 800;
        final bool isNavActive = _isNavActive(context);
        final int activeIndex = _calculateSelectedIndex(context);

        return Scaffold(
          appBar: AppBar(
            title: const Text('DravYantra',
                style: TextStyle(fontWeight: FontWeight.bold)),
            leading: isSmallScreen
                ? Builder(
                    builder: (context) => AnimatedTapButton(
                      onTap: () => Scaffold.of(context).openDrawer(),
                      child: const Padding(
                        padding: EdgeInsets.all(12),
                        child: Icon(LucideIcons.menu),
                      ),
                    ),
                  )
                : null,
            actions: [
              Consumer<DataEngine>(
                builder: (context, engine, child) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: AnimatedTapButton(
                      onTap: () => context.go('/settings'),
                      child: Tooltip(
                        message: engine.isConnected
                            ? 'Connected to Server'
                            : 'Disconnected - Tap to check settings',
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: engine.isConnected
                                ? Colors.green.withOpacity(0.1)
                                : Colors.red.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: engine.isConnected
                                    ? Colors.green
                                    : Colors.red,
                                width: 1.5),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _PulsingDot(
                                  color: engine.isConnected
                                      ? Colors.green
                                      : Colors.red,
                                  active: engine.isConnected),
                              const SizedBox(width: 4),
                              Text(
                                engine.isConnected ? 'ONLINE' : 'OFFLINE',
                                style: TextStyle(
                                  color: engine.isConnected
                                      ? Colors.green
                                      : Colors.red,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
              Consumer<DataEngine>(
                builder: (context, engine, child) {
                  final hasAlerts = engine.hasNewAlerts &&
                      engine.alerts.any(
                          (a) => a.status == AlertStatus.pending);
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      AnimatedTapButton(
                        onTap: () {
                          engine.markAlertsAsRead();
                          context.go('/alerts');
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Icon(LucideIcons.bell,
                              color: hasAlerts ? Colors.black : null),
                        ),
                      ),
                      if (hasAlerts)
                        Positioned(
                          top: 12,
                          right: 12,
                          child: _PulsingDot(
                              color: Colors.orange, active: true),
                        ),
                    ],
                  );
                },
              ),
              const SizedBox(width: 8),
            ],
          ),
          drawer: isSmallScreen ? const _AppDrawer() : null,
          body: Row(
            children: [
              if (!isSmallScreen)
                NavigationRail(
                  selectedIndex: isNavActive ? activeIndex : null,
                  onDestinationSelected: (index) =>
                      _onItemTapped(index, context),
                  labelType: NavigationRailLabelType.all,
                  selectedIconTheme:
                      const IconThemeData(color: AppTheme.primaryBlue),
                  selectedLabelTextStyle: const TextStyle(
                      color: AppTheme.primaryBlue,
                      fontWeight: FontWeight.bold),
                  unselectedIconTheme:
                      const IconThemeData(color: AppTheme.textSecondary),
                  unselectedLabelTextStyle:
                      const TextStyle(color: AppTheme.textSecondary),
                  destinations: const [
                    NavigationRailDestination(
                        icon: Icon(LucideIcons.layoutDashboard),
                        label: Text('Dashboard')),
                    NavigationRailDestination(
                        icon: Icon(LucideIcons.truck),
                        label: Text('Vehicles')),
                    NavigationRailDestination(
                        icon: Icon(LucideIcons.users),
                        label: Text('Drivers')),
                    NavigationRailDestination(
                        icon: Icon(LucideIcons.mapPin),
                        label: Text('Trips')),
                    NavigationRailDestination(
                        icon: Icon(LucideIcons.settings),
                        label: Text('Settings')),
                  ],
                ),
              if (!isSmallScreen) const VerticalDivider(thickness: 1, width: 1),
              Expanded(child: child),
            ],
          ),
          bottomNavigationBar: isSmallScreen
              ? _AnimatedBottomNav(
                  activeIndex: isNavActive ? activeIndex : 0,
                  onTap: (index) => _onItemTapped(index, context),
                )
              : null,
        );
      },
    );
  }
}

/// ── Animated bottom nav bar ───────────────────────────────────────────────
class _AnimatedBottomNav extends StatelessWidget {
  final int activeIndex;
  final ValueChanged<int> onTap;

  const _AnimatedBottomNav(
      {required this.activeIndex, required this.onTap});

  static const _items = [
    (icon: LucideIcons.layoutDashboard, label: 'Dashboard'),
    (icon: LucideIcons.truck, label: 'Vehicles'),
    (icon: LucideIcons.users, label: 'Drivers'),
    (icon: LucideIcons.mapPin, label: 'Trips'),
  ];

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final initial =
        user?.email?.substring(0, 1).toUpperCase() ?? 'D';

    return Container(
      height: 72,
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Regular nav items
            ..._items.asMap().entries.map((e) {
              final i = e.key;
              final item = e.value;
              final selected = activeIndex == i;
              return Expanded(
                child: AnimatedTapButton(
                  onTap: () => onTap(i),
                  child: _NavItem(
                    icon: item.icon,
                    label: item.label,
                    selected: selected,
                  ),
                ),
              );
            }),
            // Profile tab (index 4)
            Expanded(
              child: AnimatedTapButton(
                onTap: () => onTap(4),
                child: _ProfileNavItem(
                  initial: initial,
                  selected: activeIndex == 4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;

  const _NavItem(
      {required this.icon, required this.label, required this.selected});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
            color: selected
                ? AppTheme.primaryBlue.withOpacity(0.12)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            icon,
            color: selected ? AppTheme.primaryBlue : AppTheme.textSecondary,
            size: 22,
          ),
        ),
        const SizedBox(height: 2),
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 200),
          style: TextStyle(
            fontSize: 10,
            fontWeight:
                selected ? FontWeight.bold : FontWeight.normal,
            color: selected
                ? AppTheme.primaryBlue
                : AppTheme.textSecondary,
          ),
          child: Text(label),
        ),
      ],
    );
  }
}

class _ProfileNavItem extends StatelessWidget {
  final String initial;
  final bool selected;

  const _ProfileNavItem(
      {required this.initial, required this.selected});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
                color: selected
                    ? AppTheme.primaryBlue
                    : Colors.transparent,
                width: 2),
          ),
          child: CircleAvatar(
            radius: 10,
            backgroundColor: AppTheme.primaryBlue,
            child: Text(
              initial,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.bold),
            ),
          ),
        ),
        const SizedBox(height: 2),
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 200),
          style: TextStyle(
            fontSize: 10,
            fontWeight:
                selected ? FontWeight.bold : FontWeight.normal,
            color:
                selected ? AppTheme.primaryBlue : AppTheme.textSecondary,
          ),
          child: const Text('Profile'),
        ),
      ],
    );
  }
}

/// ── Pulsing dot indicator ─────────────────────────────────────────────────
class _PulsingDot extends StatefulWidget {
  final Color color;
  final bool active;

  const _PulsingDot({required this.color, required this.active});

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1000));
    _anim =
        Tween<double>(begin: 0.6, end: 1.0).animate(_ctrl);
    if (widget.active) _ctrl.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(_PulsingDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !_ctrl.isAnimating) {
      _ctrl.repeat(reverse: true);
    } else if (!widget.active) {
      _ctrl.stop();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
      ),
    );
  }
}

/// ── Side / hamburger drawer ───────────────────────────────────────────────
class _AppDrawer extends StatelessWidget {
  const _AppDrawer();

  @override
  Widget build(BuildContext context) {
    const items = [
      (icon: LucideIcons.map, title: 'Tracking', path: '/live-tracking'),
      (icon: LucideIcons.alertTriangle, title: 'Alerts', path: '/alerts'),
      (icon: LucideIcons.barChart2, title: 'Analytics', path: '/analytics'),
      (icon: LucideIcons.fileText, title: 'Reports', path: '/reports'),
      (icon: LucideIcons.fuel, title: 'Fuel', path: '/fuel'),
      (icon: LucideIcons.settings, title: 'Settings', path: '/settings'),
    ];

    return Drawer(
      width: MediaQuery.of(context).size.width * 0.75,
      child: Column(
        children: [
          const _DrawerHeader(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                ...items.asMap().entries.map((e) => FadeSlideIn(
                      index: e.key,
                      child: _DrawerItem(
                        icon: e.value.icon,
                        title: e.value.title,
                        path: e.value.path,
                      ),
                    )),
                const SizedBox(height: 8),
                const Divider(),
                FadeSlideIn(
                  index: items.length,
                  child: _LogoutTile(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader();

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final initial =
        user?.email?.substring(0, 1).toUpperCase() ?? 'D';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 60, 20, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1d4ed8), Color(0xFF3b82f6)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: Colors.white.withOpacity(0.2),
            child: Text(
              initial,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'DravYantra',
            style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold),
          ),
          const Text(
            'Fleet Management',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _DrawerItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String path;

  const _DrawerItem(
      {required this.icon, required this.title, required this.path});

  @override
  Widget build(BuildContext context) {
    final bool isSelected =
        GoRouterState.of(context).uri.toString().startsWith(path);
    return AnimatedTapButton(
      onTap: () {
        Navigator.pop(context);
        context.go(path);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryBlue.withOpacity(0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon,
                color: isSelected
                    ? AppTheme.primaryBlue
                    : AppTheme.textSecondary,
                size: 20),
            const SizedBox(width: 14),
            Text(
              title,
              style: TextStyle(
                color: isSelected
                    ? AppTheme.primaryBlue
                    : AppTheme.textPrimary,
                fontWeight: isSelected
                    ? FontWeight.w600
                    : FontWeight.normal,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LogoutTile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AnimatedTapButton(
      onTap: () async {
        Navigator.pop(context); // Close drawer
        final confirm = await showLogoutConfirmDialog(context);
        if (confirm && context.mounted) {
          await SessionManager.clearSession();
          await FirebaseAuth.instance.signOut();
          await GoogleSignIn().signOut();
          Provider.of<DataEngine>(context, listen: false).clearData();
          if (context.mounted) context.go('/login');
        }
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: const Row(
          children: [
            Icon(LucideIcons.logOut, color: AppTheme.danger, size: 20),
            SizedBox(width: 14),
            Text(
              'Logout',
              style: TextStyle(
                  color: AppTheme.danger,
                  fontWeight: FontWeight.w600,
                  fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}
