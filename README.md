# Verificación de comprobantes

Página pública que verifica los comprobantes de pago de cuotas del coro.

Cada comprobante lleva un código QR con sus datos firmados digitalmente (Ed25519) por la tesorería. Al escanearlo se abre esta página, que comprueba la firma con la clave pública de `config.json`. La clave privada nunca se publica.

Los datos del comprobante van en el enlace después de `#`, que el navegador no envía al servidor, así que esta página no recibe ni guarda información de nadie.

La verificación usa [noble-ed25519](https://github.com/paulmillr/noble-ed25519) 3.2.0 (licencia MIT), incluida en `vendor/`.
