import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return const FirebaseOptions(
      apiKey: 'AIzaSyDixdqLoGuiOH7lsBMD6hYEUcRIpPzRaao',
      appId: '1:487303187106:web:6d14288c4cd28a8631a5fb',
      messagingSenderId: '487303187106',
      projectId: 'dravyantra-7d2a1',
      authDomain: 'dravyantra-7d2a1.firebaseapp.com',
      storageBucket: 'dravyantra-7d2a1.firebasestorage.app',
      measurementId: 'G-DEMTERXSM7',
    );
  }
}
