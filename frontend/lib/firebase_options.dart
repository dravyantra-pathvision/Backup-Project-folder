import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return const FirebaseOptions(
      apiKey: 'YOUR_FIREBASE_API_KEY',
      appId: '1:378948290409:web:a6a8d974eb6464b1519ff8',
      messagingSenderId: '378948290409',
      projectId: 'dravyantra',
      authDomain: 'dravyantra.firebaseapp.com',
      storageBucket: 'dravyantra.firebasestorage.app',
      measurementId: 'G-TVBC57TZ7D',
    );
  }
}
