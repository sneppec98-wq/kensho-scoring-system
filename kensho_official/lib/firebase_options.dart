import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.windows:
        return windows;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM',
    appId: '1:847888051133:web:fdd362c642c654bd2080d4',
    messagingSenderId: '847888051133',
    projectId: 'adm-spartan-sport-2f4ec',
    authDomain: 'adm-spartan-sport-2f4ec.firebaseapp.com',
    storageBucket: 'adm-spartan-sport-2f4ec.firebasestorage.app',
    measurementId: 'G-SC7SBDVHZ2',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM',
    appId: '1:847888051133:android:fdd362c642c654bd2080d4', // Approximated
    messagingSenderId: '847888051133',
    projectId: 'adm-spartan-sport-2f4ec',
    storageBucket: 'adm-spartan-sport-2f4ec.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM',
    appId: '1:847888051133:ios:fdd362c642c654bd2080d4', // Approximated
    messagingSenderId: '847888051133',
    projectId: 'adm-spartan-sport-2f4ec',
    storageBucket: 'adm-spartan-sport-2f4ec.firebasestorage.app',
    iosBundleId: 'com.kensho.official',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM',
    appId: '1:847888051133:web:fdd362c642c654bd2080d4',
    messagingSenderId: '847888051133',
    projectId: 'adm-spartan-sport-2f4ec',
    authDomain: 'adm-spartan-sport-2f4ec.firebaseapp.com',
    storageBucket: 'adm-spartan-sport-2f4ec.firebasestorage.app',
    measurementId: 'G-SC7SBDVHZ2',
  );
}
