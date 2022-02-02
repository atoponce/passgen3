# passgen3
Modern JavaScript replacement of [Arnold Reinhold's PassGen2 Java applet](https://theworld.com/~reinhold/passgen.html)

- Replaced broken RC4 with Spritz.
- Increased minimal security margin to at least 72 bits.
- Added new templates:
  - Diceware
  - Pseudowords (Proquints)
- Removed weak templates:
  - "99 AAA 999"
  - "SSS 99 SSS"
