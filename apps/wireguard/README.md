# WireGuard

Your own VPN server, run by [wg-easy](https://github.com/wg-easy/wg-easy): a web page where you add a device
and get its config file or a QR code for the WireGuard app on your phone or laptop.

- Website: https://wg-easy.github.io/wg-easy/
- Source code: https://github.com/wg-easy/wg-easy

**What it needs.** Harbor asks you to allow two things when you install it: creating network tunnels
(NET_ADMIN) and passing traffic between networks (IP forwarding). It also opens UDP port 51820 on every
network of this machine.

**Reaching it from outside.** Forward UDP 51820 on your router to this machine, and give wg-easy your public IP
or a domain as its host during setup. Inside your home network it works without that.
