import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/engine.dart';

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
    return 0; // Default
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
            title: const Text('DravYantra', style: TextStyle(fontWeight: FontWeight.bold)),
            leading: isSmallScreen ? Builder(
              builder: (context) => IconButton(
                icon: const Icon(LucideIcons.menu),
                onPressed: () => Scaffold.of(context).openDrawer(),
              ),
            ) : null,
            actions: [
              Consumer<DataEngine>(
                builder: (context, engine, child) {
                  final hasAlerts = engine.hasNewAlerts && engine.alerts.any((a) => a.status == AlertStatus.pending);
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      IconButton(
                        icon: Icon(LucideIcons.bell, color: hasAlerts ? Colors.black : null), 
                        onPressed: () {
                          engine.markAlertsAsRead();
                          context.go('/alerts');
                        },
                        tooltip: 'Alerts',
                      ),
                      if (hasAlerts)
                        Positioned(
                          top: 12,
                          right: 12,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Colors.orange, // Orange dot
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              const SizedBox(width: 16),
            ],
          ),
          drawer: isSmallScreen ? const _AppDrawer() : null,
          body: Row(
            children: [
              if (!isSmallScreen)
                NavigationRail(
                  selectedIndex: isNavActive ? activeIndex : null,
                  onDestinationSelected: (index) => _onItemTapped(index, context),
                  labelType: NavigationRailLabelType.all,
                  selectedIconTheme: const IconThemeData(color: AppTheme.primaryBlue),
                  selectedLabelTextStyle: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold),
                  unselectedIconTheme: const IconThemeData(color: AppTheme.textSecondary),
                  unselectedLabelTextStyle: const TextStyle(color: AppTheme.textSecondary),
                  destinations: const [
                    NavigationRailDestination(icon: Icon(LucideIcons.layoutDashboard), label: Text('Dashboard')),
                    NavigationRailDestination(icon: Icon(LucideIcons.truck), label: Text('Vehicles')),
                    NavigationRailDestination(icon: Icon(LucideIcons.users), label: Text('Drivers')),
                    NavigationRailDestination(icon: Icon(LucideIcons.mapPin), label: Text('Trips')),
                    NavigationRailDestination(icon: Icon(LucideIcons.settings), label: Text('Settings')),
                  ],
                ),
              if (!isSmallScreen) const VerticalDivider(thickness: 1, width: 1),
              Expanded(child: child),
            ],
          ),
          bottomNavigationBar: isSmallScreen
              ? BottomNavigationBar(
                  currentIndex: activeIndex > 4 ? 4 : activeIndex, // Limit to 5 items for bottom nav
                  onTap: (index) {
                     if (index == 4) {
                       context.go('/settings'); 
                     } else {
                       _onItemTapped(index, context);
                     }
                  },
                  type: BottomNavigationBarType.fixed,
                  selectedItemColor: isNavActive ? AppTheme.primaryBlue : AppTheme.textSecondary,
                  unselectedItemColor: AppTheme.textSecondary,
                  items: [
                    const BottomNavigationBarItem(icon: Icon(LucideIcons.layoutDashboard), label: 'Dashboard'),
                    const BottomNavigationBarItem(icon: Icon(LucideIcons.truck), label: 'Vehicles'),
                    const BottomNavigationBarItem(icon: Icon(LucideIcons.users), label: 'Drivers'),
                    const BottomNavigationBarItem(icon: Icon(LucideIcons.mapPin), label: 'Trips'),
                    BottomNavigationBarItem(
                      icon: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: (isNavActive && activeIndex >= 4) ? AppTheme.primaryBlue : Colors.transparent, 
                            width: 2
                          ),
                        ),
                        child: CircleAvatar(
                          radius: 10,
                          backgroundColor: AppTheme.primaryBlue,
                          child: Text(
                            (FirebaseAuth.instance.currentUser?.email?.substring(0, 1).toUpperCase() ?? 'D'), 
                            style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)
                          ),
                        ),
                      ), 
                      label: 'Profile'
                    ),
                  ],
                )
              : null,
        );
      },
    );
  }
}

class _AppDrawer extends StatelessWidget {
  const _AppDrawer();

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: MediaQuery.of(context).size.width * 0.75,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const DrawerHeader(
            decoration: BoxDecoration(color: AppTheme.primaryBlue),
            child: Text(
              'DravYantra\nFleet Management',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            ),
          ),

          const _DrawerItem(icon: LucideIcons.map, title: 'Tracking', path: '/live-tracking'),
          const _DrawerItem(icon: LucideIcons.alertTriangle, title: 'Alerts', path: '/alerts'),
          const _DrawerItem(icon: LucideIcons.barChart2, title: 'Analytics', path: '/analytics'),
          const _DrawerItem(icon: LucideIcons.fileText, title: 'Reports', path: '/reports'),
          const _DrawerItem(icon: LucideIcons.fuel, title: 'Fuel', path: '/fuel'),
          const _DrawerItem(icon: LucideIcons.settings, title: 'Settings', path: '/settings'),
          const Divider(),
          ListTile(
            leading: const Icon(LucideIcons.logOut, color: AppTheme.danger),
            title: const Text('Logout', style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.w600)),
            onTap: () async {
              Navigator.pop(context); // Close drawer
              await FirebaseAuth.instance.signOut();
              if (context.mounted) context.go('/login');
            },
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

  const _DrawerItem({required this.icon, required this.title, required this.path});

  @override
  Widget build(BuildContext context) {
    final bool isSelected = GoRouterState.of(context).uri.toString().startsWith(path);
    return ListTile(
      leading: Icon(icon, color: isSelected ? AppTheme.primaryBlue : AppTheme.textSecondary),
      title: Text(title, style: TextStyle(
        color: isSelected ? AppTheme.primaryBlue : AppTheme.textPrimary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
      )),
      selected: isSelected,
      onTap: () {
        Navigator.pop(context); // Close drawer
        context.go(path);
      },
    );
  }
}

