import os
import firebase_admin
from firebase_admin import credentials

def init_firebase():
    if not firebase_admin._apps:
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-adminsdk.json")
        try:
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin SDK inicializado correctamente.")
            else:
                print(f"ADVERTENCIA: No se encontró el archivo de credenciales de Firebase en {cred_path}")
        except Exception as e:
            print(f"Error inicializando Firebase Admin SDK: {e}")
