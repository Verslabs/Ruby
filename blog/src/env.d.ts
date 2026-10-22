declare namespace App {
  interface Locals {
    /** the visitor's address, resolved by server/index.mjs behind the reverse proxy */
    clientIp?: string
  }
}
