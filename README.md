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

## Keyboard Timing Randomness and Spritz Mixing
Keyboard events are used as the primary source of randomness. Every key press is measured in three ways:

1. Which key was typed
2. When the key was pressed
3. When the key was released

In addition to keyboard events, the current time and a basic browser fingerprint are also used for sources of randomness.
All timing events are measured in milliseconds, as higher precision isn't guaranteed across browsers due to Spectre vulnerabilities and anti-fingerprinting techniques.

### Every Mixing Event
#### Page Load Mixing
Spritz is an 8-bit CSPRNG and is initiated with values 0-255. When the page loads, the state is first mixed with the millisecond fraction of the current time, producing up to 999 mixing operations:

```javascript
// use current time (milliseconds) as source randomness
let now = Date.now()
let ms = Math.floor((now/1e3 - Math.floor(now/1e3)) * 1e3)
stir(ms)
```

A basic browser fingerprint is then generated and hashed with 128-bit SipHash:

```javascript
const fp = generateFingerprint()                        // generate basic browser fingerprint
const fpHash = SipHashDouble.hash_hex("", fp)           // calculate 128-bit hash
```

The hexadecimal fingerprint is then read in 8-bit chunks, one at a time. The value of each chunk determines the number of mixing operations to Spritz. Each 8-bit chunk can produce up to 255 mixing operations. Because there are 16 chunks, there is a maximum of 4,080 mixing operations to the Spritz state.

```javascript
for (let i = 0; i < fpHash.length; i += 2) {
    let n = parseInt(fpHash.substring(i, i + 2), 16)    // Up to 4,080 mixes
    stir(n)
}
```

This does take some time to execute and will be variable based on the hardware the user has in front of them. As such, Spritz is mixed again with the current time, again producing up to 999 mixing operations:

```javascript
// use current time as source randomness again
let now = Date.now()
let ms = Math.floor((now/1e3 - Math.floor(now/1e3)) * 1e3)
stir(ms)
```

The goal here is to ensure that Spritz is uniquely shuffled before interacting with the web app. It shouldn't be trivial for other browsers, platforms, or users to duplicate that state. There are a maximum of 6,078 mixing operations, yielding about 12.569 bits of entropy for the first shuffled state.

#### Keyboard Mixing
Spritz requires four registers: `ii`, `jj`, `kk`, & `ww`. The `ii`, `jj`, & `kk` registered randomly walk around the 256 element array, but `ww` is a static register that can manipulate that random walk. In order to ensure that all 256 possible array elements are reached, `ww` must be relatively prime to 256. Because 2 is the only prime factor of 256, this means that `ww` can be any odd value, and "1" is commonly chosen.

In this implementation, the ASCII value of the pressed key is used for `ww`, with the modification that 97 is added any even-numbered ASCII code to force the result to be odd and to prevent any key value collisions with the other keys:

```javascript
if (key.key.charCodeAt(0) % 2 === 1) {  // use key code as the Spritz register "ww"
    ww = key.key.charCodeAt(0)
} else {
    ww = 97 + key.key.charCodeAt(0)     // make odd (must be coprime to 256) and don't collide with another key code
}
```

Once `ww` has been assigned, the Spritz state is then mixed the number of times determined by the time the key was pressed using the value of the key as `ww` during that mixing operation. The time the key is pressed is measured in milliseconds using `Date.now()` just like when the page was loaded. As such, there are a maximum of 999 + 999 = 1,998 Spritz mixing operations with the current value of `ww`:

```javascript
// use current time of key down/up (milliseconds) as source randomness
let now = Date.now()
let ms = Math.floor((now/1e3 - Math.floor(now/1e3)) * 1e3)
stir(ms)
```

 Both the key value and the time the key was pressed and released ensure that the Spritz state is 100% influenced by the user's typing variability.

 #### RNG Extraction
Previous mixing operations up to this point are designed to avoid the potential RC4-like early biases in the keystream while also putting Spritz into a unique state. Spritz may or may not be vulnerable to early keystream biases like RC4, but the operations do not get in the way of UX, so we're playing it safe instead of sorry.

With that said, there is one more mixing operation done before the value is extracted from the RNG to build the password. A global `NMIXES = 10 * 256` variable is set forcing 10 passes through all 256 array elements. All the Spritz registers are reset to their default values. This is placed in the `extract(r)` function before outputing our random number:

```javascript
ii = jj = kk = zz = 0
ww = 1

stir(NMIXES)
```
This adds an additional 2,560 mixing operations to the previous mixing already done. This is the equivalent of discarding a maximum of 2,560 + 6,080 + 1,998 = 10,638 keystream values before asking for random numbers.

Finally, we generate a random number uniformly and use that to build the next character or word in the password:

```javascript
let min = 256 % r

do {
    q = stir(1)
} while (q < min)   // avoid bias choice

return (q % r)
```

Each key press will provide an additional maximum of 1,998 mixing operations before returning a random number from the Spritz state.