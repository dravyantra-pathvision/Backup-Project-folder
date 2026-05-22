import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'firebase_options.dart';
import 'core/theme.dart';
import 'models/engine.dart';
import 'router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint("Firebase initialization failed: $e");
  }

  await Supabase.initialize(
    url: 'https://zjmvmgneevskjqpiggau.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXZtZ25lZXZza2pxcGlnZ2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjQxOTksImV4cCI6MjA5NDc0MDE5OX0.1iN2jDclKYwTGdCHhlV9sE3kwQQUx3yXfhjvAT3jQlI',
  );
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => DataEngine()),
      ],
      child: const DravYantraApp(),
    ),
  );
}

class DravYantraApp extends StatelessWidget {
  const DravYantraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'DravYantra',
      theme: AppTheme.lightTheme,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
