"""Configuracion inicial: autentica con Garmin Connect y guarda la sesion.

Ejecuta este script UNA sola vez, a mano, en tu propia Terminal:

    .venv\\Scripts\\python.exe setup_garmin.py

Te pedira tu email y contrasena de Garmin Connect directamente en la
Terminal (nunca se envian a ningun chat). Si tu cuenta tiene verificacion
en dos pasos (MFA), tambien te pedira el codigo.

Al terminar, guarda una sesion cifrada en la carpeta ".garmin_tokens" de
este mismo proyecto. Esa sesion es la que usa sync_garmin.py todos los
dias para actualizar tus datos SIN volver a pedir contrasena.
"""

import getpass
import sys
from pathlib import Path

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)

TOKENSTORE = str(Path(__file__).parent / ".garmin_tokens")


def ask_mfa_code() -> str:
    return input("Codigo de verificacion (MFA) recibido por email/SMS/app: ").strip()


def main() -> None:
    print("=== Configuracion de Garmin Connect ===")
    email = input("Email de tu cuenta Garmin Connect: ").strip()
    password = getpass.getpass("Contrasena (no se muestra en pantalla): ")

    if not email or not password:
        print("Email y contrasena son obligatorios.")
        sys.exit(1)

    client = Garmin(email=email, password=password, prompt_mfa=ask_mfa_code)

    try:
        client.login(TOKENSTORE)
    except GarminConnectAuthenticationError as e:
        print(f"\nNo se pudo autenticar: {e}")
        sys.exit(1)
    except GarminConnectTooManyRequestsError as e:
        print(f"\nGarmin limito los intentos de login: {e}")
        sys.exit(1)
    finally:
        # No dejar la contrasena en variables por mas tiempo del necesario.
        password = None

    print(f"\nConectado como: {client.get_full_name()} ({client.display_name})")
    print(f"Sesion guardada en: {TOKENSTORE}")
    print("\nListo. Ya puedes cerrar esta ventana.")
    print("La sincronizacion diaria programada usara esta sesion automaticamente.")


if __name__ == "__main__":
    main()
