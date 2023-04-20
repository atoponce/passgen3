# passgen3
Modern JavaScript replacement of [Arnold Reinhold's PassGen2 Java applet](https://theworld.com/~reinhold/passgen.html)

- Replaced broken RC4 with Spritz.
- Increased minimal security margin to at least 128 bits.
- Added new templates:
  - Diceware
  - Pseudowords (Proquints)
- Removed weak templates:
  - "99 AAA 999"
  - "SSS 99 SSS"

## Keyboard Timing Randomness and Spritz Mixing
Keyboard events are used as the primary source of randomness. Every key press is measured in three
ways:

1. Which key was typed
2. When the key was pressed
3. When the key was released

In addition to keyboard events, a basic browser fingerprint is also used to put the Spritz state
into a unique state. All timing events are measured in milliseconds, as higher precision isn't
guaranteed across browsers due to Spectre vulnerabilities and anti-fingerprinting techniques.

### Every Mixing Event
#### Page Load Mixing
Passgen3 uses Spritz as an 8-bit (`N=256`) CSPRNG and is initiated with values 0-255. When the page
loads, a basic browser fingerprint is calculated by getting the user agent, screen sizes, list of
plugins, if cookies are enabled, the current local and session storage data, time zone, language,
mime types, and how the browser handles building a canvas:

```javascript
const fpBytes = []
const fp = generateFingerprint()
```

This fingerprint is a large text string that is then converted to their decimal ASCII values and
stored in an array that is absorbed into the Spritz state:

```javascript
for (let i = 0; i < fp.length; i++) {
    fpBytes.push(fp.charCodeAt(i))
}

absorb(fpBytes)
absorbStop()
```

The goal here is to ensure that Spritz is uniquely shuffled before the user interacts with the web
app. It shouldn't be trivial for other browsers, platforms, or users to duplicate that state. This
is equivalent to generating an initialization vector for symmetric block ciphers.

#### Keyboard Mixing
In this implementation, the ASCII value of the pressed key, the time it was pressed, and the time it
was released are absorbed into the Spritz state. This ensures that the Spritz state is 100%
influenced by the user's typing variability.

```javascript
absorb([key.key.charCodeAt(0)])
absorbStop()

const byteArr = timeToByteArray(Date.now())

absorb(byteArr)
absorbStop()
```

#### RNG Extraction
When extracting a random number from Spritz, we need to ensure that it's done uniformly. This means
that the character set or word list we are picking from to build the password needs to be either a
factor or a multiple of `N`. As such, we check which integer is larger, `N` or the character set,
then find a minimum amount allowed to ensure the numbers we pick are from a uniform range. We then
squeeze out two integers from the state, uniformly combine them into a large-enough number, and
return that large number modulo the set size:

```javascript
let q
let min

r <= N ? min = N % r : min = r % N

do {
    q = squeeze(1) ** 2 + squeeze(1)
} while (q < min)   // avoid biased choice

return (q % r)
```
